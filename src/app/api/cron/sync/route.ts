import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/server/env";
import { getRepo } from "@/server/repo";
import { syncUser } from "@/server/sync";

export const maxDuration = 300;

/** Daily background sync. Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: NextRequest) {
  if (!env.cronSecret || req.headers.get("authorization") !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const results: Record<string, unknown> = {};
  for (const inbox of await getRepo().listInboxes()) {
    if (inbox.needsReauth) {
      results[inbox.userId] = "needs reauth";
      continue;
    }
    try {
      results[inbox.userId] = await syncUser(inbox.userId);
    } catch (e) {
      results[inbox.userId] = { error: e instanceof Error ? e.message : String(e) };
    }
  }
  return NextResponse.json({ ok: true, results });
}
