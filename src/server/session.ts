import "server-only";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { sign, verify } from "./crypto";

const COOKIE = "ra_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export interface Session {
  userId: string; // lowercased Google email
  email: string;
  exp: number;
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const s = verify<Session>(jar.get(COOKIE)?.value);
  if (!s || s.exp < Date.now()) return null;
  return s;
}

export function setSession(res: NextResponse, email: string) {
  const s: Session = { userId: email.toLowerCase(), email, exp: Date.now() + MAX_AGE * 1000 };
  res.cookies.set(COOKIE, sign(s), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function clearSession(res: NextResponse) {
  res.cookies.set(COOKIE, "", { path: "/", maxAge: 0 });
}
