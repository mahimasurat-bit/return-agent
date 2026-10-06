import "server-only";
/**
 * Gmail → purchases. Searches only shopping-related email, extracts with
 * Claude, verifies, links everything to its source email, and saves.
 */
import { decrypt } from "./crypto";
import { env } from "./env";
import { ClaudeExtractor, type Extraction, type Extractor } from "./extract";
import { GmailApi, refreshAccessToken, type GmailClient } from "./google";
import { parseGmailMessage, type ParsedEmail } from "./gmail-parse";
import { getRepo, persistDiff, type Inbox, type Repo } from "./repo";
import { applyExtraction } from "./sync-apply";
import { SHOPPING_QUERY } from "@/lib/services/email-source";

export type SyncEvent =
  | { type: "log"; message: string }
  | { type: "progress"; done: number; total: number };

export interface SyncResult {
  scanned: number;
  shopping: number;
  skipped: number;
  newPurchases: number;
  errors: number;
  more: boolean;
}

export interface SyncDeps {
  repo: Repo;
  gmail: GmailClient;
  extractor: Extractor;
  inbox: Inbox;
  onEvent?: (e: SyncEvent) => void;
  maxEmails?: number;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

export function buildQuery(inbox: Inbox): string {
  if (inbox.lastSyncedAt) {
    // Overlap two days so late-arriving mail isn't missed; already-seen messages are skipped.
    const after = Math.floor(new Date(inbox.lastSyncedAt).getTime() / 1000) - 2 * 86400;
    return `${SHOPPING_QUERY} after:${after}`;
  }
  return `${SHOPPING_QUERY} newer_than:${env.initialLookbackDays}d`;
}

export async function runSync(d: SyncDeps): Promise<SyncResult> {
  const emit = d.onEvent ?? (() => undefined);
  const userId = d.inbox.userId;
  const max = d.maxEmails ?? env.maxEmailsPerSync;
  const before = await d.repo.loadData(userId);
  const seen = new Set([...before.emails.map((e) => e.externalMessageId), ...d.inbox.skippedIds]);

  emit({ type: "log", message: d.inbox.lastSyncedAt ? "Checking for new shopping emails" : `Searching shopping emails from the last ${env.initialLookbackDays} days` });
  const listed = await d.gmail.search(buildQuery(d.inbox), 500);
  // Gmail lists newest first; process oldest first so orders exist before their returns/refunds.
  const fresh = listed.filter((m) => !seen.has(m.id)).reverse();
  const batch = fresh.slice(0, max);
  const more = fresh.length > batch.length;
  emit({ type: "log", message: batch.length ? `Found ${fresh.length} new shopping-related emails` : "No new shopping emails" });

  let done = 0;
  const results = await mapLimit(batch, 4, async (m) => {
    let parsed: ParsedEmail | null = null;
    let ex: Extraction | null = null;
    let error: string | null = null;
    try {
      parsed = parseGmailMessage(await d.gmail.get(m.id));
      ex = await d.extractor.extract(parsed);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    emit({ type: "progress", done: ++done, total: batch.length });
    return { parsed, ex, error };
  });

  const nowIso = new Date().toISOString();
  let data = before;
  let newPurchases = 0;
  let shopping = 0;
  let errors = 0;
  const skipped: string[] = [];
  const ordered = results
    .filter((r) => r.parsed)
    .sort((a, b) => a.parsed!.receivedAt.localeCompare(b.parsed!.receivedAt));

  for (const r of results) if (r.error) errors++;
  for (const r of ordered) {
    if (!r.ex) continue;
    if (r.ex.kind === "not_shopping") {
      skipped.push(r.parsed!.messageId);
      continue;
    }
    shopping++;
    const res = applyExtraction(data, r.parsed!, r.ex, userId, nowIso);
    data = res.data;
    newPurchases += res.createdPurchases;
    for (const line of res.log) emit({ type: "log", message: line });
  }
  if (skipped.length) emit({ type: "log", message: `Ignored ${skipped.length} non-shopping ${skipped.length === 1 ? "email" : "emails"}` });
  if (errors) emit({ type: "log", message: `Couldn't read ${errors} ${errors === 1 ? "email" : "emails"}. Will retry next sync` });

  await persistDiff(d.repo, userId, before, data);

  // If we stopped early, resume from the newest email we processed; otherwise from now.
  const newest = ordered.at(-1)?.parsed?.receivedAt;
  await d.repo.saveInbox({
    ...d.inbox,
    lastSyncedAt: more && newest ? newest : nowIso,
    needsReauth: false,
    skippedIds: [...d.inbox.skippedIds, ...skipped].slice(-1000),
  });

  return { scanned: batch.length, shopping, skipped: skipped.length, newPurchases, errors, more };
}

/** Production wiring: decrypt the refresh token, get an access token, run the sync. */
export const fakeProviders = () => process.env.RA_FAKE_PROVIDERS === "1" && process.env.NODE_ENV !== "production";

export async function syncUser(userId: string, onEvent?: (e: SyncEvent) => void): Promise<SyncResult> {
  const repo = getRepo();
  const inbox = await repo.getInbox(userId);
  if (!inbox) throw new Error("Gmail isn't connected.");
  if (fakeProviders()) {
    const { FakeGmail, FakeExtractor } = await import("./fakes");
    return runSync({ repo, gmail: new FakeGmail(), extractor: new FakeExtractor(), inbox, onEvent });
  }
  let accessToken: string;
  try {
    accessToken = await refreshAccessToken(decrypt(inbox.refreshTokenEnc));
  } catch (e) {
    if ((e as { code?: string }).code === "invalid_grant") {
      await repo.saveInbox({ ...inbox, needsReauth: true });
      throw new Error("Gmail access expired. Reconnect Gmail to keep syncing.");
    }
    throw e;
  }
  return runSync({ repo, gmail: new GmailApi(accessToken), extractor: new ClaudeExtractor(), inbox, onEvent });
}
