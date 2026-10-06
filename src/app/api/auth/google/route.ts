import { NextResponse, type NextRequest } from "next/server";
import { configStatus } from "@/server/env";
import { randomToken } from "@/server/crypto";
import { authUrl } from "@/server/google";

export async function GET(req: NextRequest) {
  if (!configStatus().gmail) return NextResponse.redirect(new URL("/?error=not_configured", req.url));
  const state = randomToken();
  const res = NextResponse.redirect(authUrl(req.nextUrl.origin, state));
  res.cookies.set("ra_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
