import "server-only";
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "./env";

function key(purpose: string): Buffer {
  if (env.appSecret.length < 32) throw new Error("APP_SECRET must be set (32+ characters).");
  return Buffer.from(hkdfSync("sha256", env.appSecret, "return-agent", purpose, 32));
}

const b64u = (b: Buffer) => b.toString("base64url");

/** AES-256-GCM. Used for the Gmail refresh token at rest. */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key("token-encryption"), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [b64u(iv), b64u(c.getAuthTag()), b64u(data)].join(".");
}

export function decrypt(token: string): string {
  const [iv, tag, data] = token.split(".").map((s) => Buffer.from(s, "base64url"));
  const d = createDecipheriv("aes-256-gcm", key("token-encryption"), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}

export function sign(payload: object): string {
  const body = b64u(Buffer.from(JSON.stringify(payload)));
  const mac = b64u(createHmac("sha256", key("session")).update(body).digest());
  return `${body}.${mac}`;
}

export function verify<T>(token: string | undefined): T | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", key("session")).update(body).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export const randomToken = () => b64u(randomBytes(24));
