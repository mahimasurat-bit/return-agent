import "server-only";
import { env } from "./env";

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export function redirectUri(origin: string) {
  return `${env.appUrl || origin}/api/auth/google/callback`;
}

export function authUrl(origin: string, state: string) {
  const p = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: `openid email ${GMAIL_SCOPE}`,
    access_type: "offline",
    prompt: "consent", // always return a refresh token
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok || json.error) {
    const err = new Error(`Google token error: ${json.error ?? res.status} ${json.error_description ?? ""}`.trim());
    (err as Error & { code?: string }).code = json.error;
    throw err;
  }
  return json;
}

export function exchangeCode(code: string, origin: string) {
  return tokenRequest({
    code,
    client_id: env.googleClientId,
    client_secret: env.googleClientSecret,
    redirect_uri: redirectUri(origin),
    grant_type: "authorization_code",
  });
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const t = await tokenRequest({
    refresh_token: refreshToken,
    client_id: env.googleClientId,
    client_secret: env.googleClientSecret,
    grant_type: "refresh_token",
  });
  return t.access_token;
}

export async function revokeToken(token: string) {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: "POST" }).catch(() => undefined);
}

/** Email from the id_token returned directly by Google's token endpoint over TLS. */
export function emailFromIdToken(idToken: string | undefined): { email: string; verified: boolean } | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8"));
    return { email: String(payload.email ?? ""), verified: payload.email_verified === true };
  } catch {
    return null;
  }
}

/* ── Gmail API ─────────────────────────────────────────────── */

export interface GmailHeader {
  name: string;
  value: string;
}
export interface GmailPart {
  mimeType: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: GmailPart[];
}
export interface GmailMessage {
  id: string;
  threadId: string;
  internalDate: string; // ms since epoch
  snippet?: string;
  labelIds?: string[];
  payload: GmailPart;
}

/** What the sync pipeline needs from Gmail. Swappable for tests. */
export interface GmailClient {
  search(query: string, max: number): Promise<{ id: string }[]>;
  get(id: string): Promise<GmailMessage>;
}

export class GmailApi implements GmailClient {
  constructor(private accessToken: string) {}

  private async call<T>(pathAndQuery: string): Promise<T> {
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${pathAndQuery}`, {
      headers: { authorization: `Bearer ${this.accessToken}` },
    });
    if (!res.ok) throw new Error(`Gmail API ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return (await res.json()) as T;
  }

  async search(query: string, max: number) {
    const out: { id: string }[] = [];
    let pageToken: string | undefined;
    do {
      const p = new URLSearchParams({ q: query, maxResults: String(Math.min(100, max - out.length)) });
      if (pageToken) p.set("pageToken", pageToken);
      const r = await this.call<{ messages?: { id: string }[]; nextPageToken?: string }>(`messages?${p}`);
      out.push(...(r.messages ?? []));
      pageToken = r.nextPageToken;
    } while (pageToken && out.length < max);
    return out;
  }

  get(id: string) {
    return this.call<GmailMessage>(`messages/${id}?format=full`);
  }
}
