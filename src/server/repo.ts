import "server-only";
/**
 * Persistence. Supabase in production; a local JSON file when Supabase isn't
 * configured (handy for running on your laptop before setting Supabase up).
 *
 * Records are stored as JSON documents keyed by (user, collection, id) so the
 * server stores exactly the types the UI uses. See supabase/schema.sql.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { EMPTY_DATA, type DataState } from "@/lib/domain";
import { env } from "./env";

export type Collection = keyof DataState;
export const COLLECTIONS: Collection[] = ["purchases", "emails", "returns", "refunds", "activities"];

export interface Inbox {
  userId: string;
  email: string;
  refreshTokenEnc: string;
  lastSyncedAt: string | null;
  needsReauth: boolean;
  createdAt: string;
  /** Recently checked non-shopping message ids, so they aren't sent to Claude twice. */
  skippedIds: string[];
  /** When the last digest email went out. */
  lastDigestAt?: string | null;
}

export interface Repo {
  loadData(userId: string): Promise<DataState>;
  upsert(userId: string, collection: Collection, records: { id: string }[]): Promise<void>;
  deleteUserData(userId: string): Promise<void>;
  getInbox(userId: string): Promise<Inbox | null>;
  saveInbox(inbox: Inbox): Promise<void>;
  listInboxes(): Promise<Inbox[]>;
  deleteInbox(userId: string): Promise<void>;
}

/** Upsert only the records that changed between two snapshots. */
export async function persistDiff(repo: Repo, userId: string, before: DataState, after: DataState) {
  for (const c of COLLECTIONS) {
    const prev = new Map((before[c] as { id: string }[]).map((r) => [r.id, JSON.stringify(r)]));
    const changed = (after[c] as { id: string }[]).filter((r) => prev.get(r.id) !== JSON.stringify(r));
    if (changed.length) await repo.upsert(userId, c, changed);
  }
}

/* ── Supabase ─────────────────────────────────────────────── */

class SupabaseRepo implements Repo {
  private db: SupabaseClient;
  constructor(url: string, key: string) {
    this.db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  async loadData(userId: string): Promise<DataState> {
    const out: DataState = { purchases: [], emails: [], returns: [], refunds: [], activities: [] };
    const page = 1000;
    for (let from = 0; ; from += page) {
      const { data, error } = await this.db
        .from("records")
        .select("collection,data")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .range(from, from + page - 1);
      if (error) throw new Error(`Supabase load failed: ${error.message}`);
      for (const row of data ?? []) {
        const c = row.collection as Collection;
        if (c in out) (out[c] as unknown[]).push(row.data);
      }
      if (!data || data.length < page) break;
    }
    return out;
  }

  async upsert(userId: string, collection: Collection, records: { id: string }[]) {
    for (let i = 0; i < records.length; i += 500) {
      const rows = records.slice(i, i + 500).map((r) => ({
        user_id: userId,
        collection,
        id: r.id,
        data: r,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await this.db.from("records").upsert(rows, { onConflict: "user_id,collection,id" });
      if (error) throw new Error(`Supabase save failed: ${error.message}`);
    }
  }

  async deleteUserData(userId: string) {
    const { error } = await this.db.from("records").delete().eq("user_id", userId);
    if (error) throw new Error(error.message);
  }

  async getInbox(userId: string): Promise<Inbox | null> {
    const { data, error } = await this.db.from("inboxes").select("*").eq("user_id", userId).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? fromRow(data) : null;
  }

  async saveInbox(i: Inbox) {
    const { error } = await this.db.from("inboxes").upsert({
      user_id: i.userId,
      email: i.email,
      refresh_token_enc: i.refreshTokenEnc,
      last_synced_at: i.lastSyncedAt,
      needs_reauth: i.needsReauth,
      created_at: i.createdAt,
      skipped_ids: i.skippedIds.slice(-1000),
      last_digest_at: i.lastDigestAt ?? null,
    });
    if (error) throw new Error(error.message);
  }

  async listInboxes(): Promise<Inbox[]> {
    const { data, error } = await this.db.from("inboxes").select("*");
    if (error) throw new Error(error.message);
    return (data ?? []).map(fromRow);
  }

  async deleteInbox(userId: string) {
    const { error } = await this.db.from("inboxes").delete().eq("user_id", userId);
    if (error) throw new Error(error.message);
  }
}

function fromRow(r: Record<string, unknown>): Inbox {
  return {
    userId: r.user_id as string,
    email: r.email as string,
    refreshTokenEnc: r.refresh_token_enc as string,
    lastSyncedAt: (r.last_synced_at as string) ?? null,
    needsReauth: !!r.needs_reauth,
    createdAt: r.created_at as string,
    skippedIds: (r.skipped_ids as string[]) ?? [],
    lastDigestAt: (r.last_digest_at as string) ?? null,
  };
}

/* ── Local file (development) ─────────────────────────────── */

interface FileShape {
  inboxes: Record<string, Inbox>;
  data: Record<string, DataState>;
}

class FileRepo implements Repo {
  private file = process.env.LOCAL_DATA_FILE || path.join(process.cwd(), ".data", "return-agent.json");
  private chain: Promise<unknown> = Promise.resolve();

  private async read(): Promise<FileShape> {
    try {
      return JSON.parse(await fs.readFile(this.file, "utf8")) as FileShape;
    } catch {
      return { inboxes: {}, data: {} };
    }
  }

  private mutate(fn: (s: FileShape) => void): Promise<void> {
    const run = this.chain.then(async () => {
      const s = await this.read();
      fn(s);
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      await fs.writeFile(this.file, JSON.stringify(s, null, 1));
    });
    this.chain = run.catch(() => undefined);
    return run;
  }

  async loadData(userId: string) {
    const s = await this.read();
    return { ...structuredClone(EMPTY_DATA), ...(s.data[userId] ?? {}) };
  }

  upsert(userId: string, collection: Collection, records: { id: string }[]) {
    return this.mutate((s) => {
      const d = (s.data[userId] ??= structuredClone(EMPTY_DATA));
      const list = d[collection] as { id: string }[];
      for (const r of records) {
        const i = list.findIndex((x) => x.id === r.id);
        if (i >= 0) list[i] = r;
        else list.push(r);
      }
    });
  }

  deleteUserData(userId: string) {
    return this.mutate((s) => {
      delete s.data[userId];
    });
  }

  async getInbox(userId: string) {
    return (await this.read()).inboxes[userId] ?? null;
  }

  saveInbox(i: Inbox) {
    return this.mutate((s) => {
      s.inboxes[i.userId] = i;
    });
  }

  async listInboxes() {
    return Object.values((await this.read()).inboxes);
  }

  deleteInbox(userId: string) {
    return this.mutate((s) => {
      delete s.inboxes[userId];
    });
  }
}

let repo: Repo | null = null;
export function getRepo(): Repo {
  if (!repo) {
    repo =
      env.supabaseUrl && env.supabaseServiceKey ? new SupabaseRepo(env.supabaseUrl, env.supabaseServiceKey) : new FileRepo();
  }
  return repo;
}
