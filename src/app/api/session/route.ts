import { NextResponse } from "next/server";
import { configStatus } from "@/server/env";
import { getRepo } from "@/server/repo";
import { getSession } from "@/server/session";

export async function GET() {
  const config = configStatus();
  let s = null;
  try {
    s = config.secret ? await getSession() : null;
  } catch {
    s = null;
  }
  const inbox = s ? await getRepo().getInbox(s.userId) : null;
  return NextResponse.json({
    config: { gmail: config.gmail, extraction: config.extraction, digest: config.digest, storage: config.storage, missing: config.missing },
    signedIn: !!(s && inbox),
    email: s?.email ?? null,
    lastSyncedAt: inbox?.lastSyncedAt ?? null,
    needsReauth: inbox?.needsReauth ?? false,
  });
}
