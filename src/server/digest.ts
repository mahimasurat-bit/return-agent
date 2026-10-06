import "server-only";
/**
 * Sends the digest email for one user via Resend (https://resend.com).
 * Runs from the daily cron after the Gmail sync, and from "Send me one now".
 */
import { buildDigest, digestDue } from "@/lib/digest";
import { env } from "./env";
import { getRepo } from "./repo";

export type DigestResult =
  | { sent: true; to: string; subject: string }
  | { sent: false; reason: "not_configured" | "not_due" | "nothing_to_report" | "error"; detail?: string };

export async function maybeSendDigest(userId: string, opts: { force?: boolean; appUrl?: string } = {}): Promise<DigestResult> {
  if (!env.resendKey) return { sent: false, reason: "not_configured" };
  const repo = getRepo();
  const inbox = await repo.getInbox(userId);
  if (!inbox) return { sent: false, reason: "error", detail: "No inbox" };

  const data = await repo.loadData(userId);
  const appUrl = env.appUrl || opts.appUrl || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  const d = buildDigest(data, { appUrl, since: inbox.lastDigestAt ?? null, everyDays: env.digestEveryDays });

  if (!opts.force) {
    if (!d.shouldSend) return { sent: false, reason: "nothing_to_report" };
    if (!digestDue(inbox.lastDigestAt ?? null, env.digestEveryDays, d.urgent)) return { sent: false, reason: "not_due" };
  }

  const to = env.digestTo || inbox.email;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.resendKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.digestFrom, to: [to], subject: `Return Agent: ${d.subject}`, html: d.html, text: d.text }),
  });
  if (!res.ok) return { sent: false, reason: "error", detail: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}` };

  await repo.saveInbox({ ...inbox, lastDigestAt: new Date().toISOString() });
  return { sent: true, to, subject: d.subject };
}
