import { NextResponse, type NextRequest } from "next/server";
import { encrypt } from "@/server/crypto";
import { getRepo } from "@/server/repo";
import { setSession } from "@/server/session";
import { fakeProviders } from "@/server/sync";

/** DEVELOPMENT ONLY: sign in as a fake Gmail user to test the live pipeline without Google. */
export async function GET(req: NextRequest) {
  if (!fakeProviders()) return NextResponse.json({ error: "Not available" }, { status: 404 });
  const email = "test@example.com";
  const repo = getRepo();
  const existing = await repo.getInbox(email);
  await repo.saveInbox(
    existing ?? {
      userId: email,
      email,
      refreshTokenEnc: encrypt("fake"),
      lastSyncedAt: null,
      needsReauth: false,
      createdAt: new Date().toISOString(),
      skippedIds: [],
    },
  );
  const res = NextResponse.redirect(new URL(existing?.lastSyncedAt ? "/" : "/?connected=1", req.url));
  setSession(res, email);
  return res;
}
