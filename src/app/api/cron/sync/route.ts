import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/server/env";
import { getRepo } from "@/server/repo";
import { syncUser } from "@/server/sync";
import { maybeSendDigest } from "@/server/digest";

export const maxDuration = 300;

/** Daily background agent: sync Gmail, then send the digest if one is due. Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: NextRequest) {
  if (!env.cronSecret || req.headers.get("authorization") !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const results: Record<string, unknown> = {};
  for (const inbox of await getRepo().listInboxes()) {
    const r: Record<string, unknown> = {};
    if (inbox.needsReauth) r.sync = "needs reauth";
    else {
      try {
        r.sync = await syncUser(inbox.userId);
      } catch (e) {
        r.sync = { error: e instanceof Error ? e.message : String(e) };
      }
    }
    // The agent emails only when something needs attention, on the configured cadence.
    try {
      r.digest = await maybeSendDigest(inbox.userId);
    } catch (e) {
      r.digest = { error: e instanceof Error ? e.message : String(e) };
    }
    results[inbox.userId] = r;
  }
  return NextResponse.json({ ok: true, results });
}
