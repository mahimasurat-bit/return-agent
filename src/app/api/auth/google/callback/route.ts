import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/server/env";
import { encrypt } from "@/server/crypto";
import { emailFromIdToken, exchangeCode, GMAIL_SCOPE } from "@/server/google";
import { getRepo } from "@/server/repo";
import { setSession } from "@/server/session";

function fail(req: NextRequest, code: string) {
  const res = NextResponse.redirect(new URL(`/?error=${code}`, req.url));
  res.cookies.set("ra_oauth_state", "", { path: "/", maxAge: 0 });
  return res;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  if (q.get("error")) return fail(req, "access_denied");
  const state = q.get("state");
  const code = q.get("code");
  if (!code || !state || state !== req.cookies.get("ra_oauth_state")?.value) return fail(req, "bad_state");

  let tokens;
  try {
    tokens = await exchangeCode(code, req.nextUrl.origin);
  } catch {
    return fail(req, "token_exchange");
  }
  const who = emailFromIdToken(tokens.id_token);
  if (!who?.email || !who.verified) return fail(req, "no_email");
  const userId = who.email.toLowerCase();
  if (!env.allowedEmails.includes(userId)) return fail(req, "not_allowed");
  if (!tokens.scope.split(" ").includes(GMAIL_SCOPE)) return fail(req, "scope_missing");

  const repo = getRepo();
  const existing = await repo.getInbox(userId);
  if (!tokens.refresh_token && !existing) return fail(req, "no_refresh_token");
  await repo.saveInbox({
    userId,
    email: who.email,
    refreshTokenEnc: tokens.refresh_token ? encrypt(tokens.refresh_token) : existing!.refreshTokenEnc,
    lastSyncedAt: existing?.lastSyncedAt ?? null,
    needsReauth: false,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    skippedIds: existing?.skippedIds ?? [],
  });

  const res = NextResponse.redirect(new URL(existing?.lastSyncedAt ? "/" : "/?connected=1", req.url));
  res.cookies.set("ra_oauth_state", "", { path: "/", maxAge: 0 });
  setSession(res, who.email);
  return res;
}
