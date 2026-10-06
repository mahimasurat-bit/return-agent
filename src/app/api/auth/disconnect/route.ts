import { NextResponse } from "next/server";
import { decrypt } from "@/server/crypto";
import { revokeToken } from "@/server/google";
import { getRepo } from "@/server/repo";
import { clearSession, getSession } from "@/server/session";

/** Revokes Gmail access and deletes everything Return Agent stored for this user. */
export async function POST() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const repo = getRepo();
  const inbox = await repo.getInbox(s.userId);
  if (inbox) {
    try {
      await revokeToken(decrypt(inbox.refreshTokenEnc));
    } catch {
      /* token may already be invalid */
    }
    await repo.deleteInbox(s.userId);
  }
  await repo.deleteUserData(s.userId);
  const res = NextResponse.json({ ok: true });
  clearSession(res);
  return res;
}
