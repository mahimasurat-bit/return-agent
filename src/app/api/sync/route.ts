import { NextResponse } from "next/server";
import { configStatus } from "@/server/env";
import { getRepo } from "@/server/repo";
import { getSession } from "@/server/session";
import { fakeProviders, syncUser, type SyncEvent } from "@/server/sync";

export const maxDuration = 300;

/** Streams sync progress as newline-delimited JSON, ending with the fresh data. */
export async function POST() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!configStatus().extraction && !fakeProviders()) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set" }, { status: 500 });

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: object) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        const result = await syncUser(s.userId, (e: SyncEvent) => send(e));
        const data = await getRepo().loadData(s.userId);
        const inbox = await getRepo().getInbox(s.userId);
        send({ type: "done", result, data, lastSyncedAt: inbox?.lastSyncedAt ?? null });
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : "Sync failed" });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" } });
}
