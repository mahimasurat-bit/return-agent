import "server-only";

/** Central place for server configuration. Nothing here is exposed to the browser. */
export const env = {
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  appUrl: process.env.APP_URL ?? "",
  appSecret: process.env.APP_SECRET ?? "",
  allowedEmails: (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  cronSecret: process.env.CRON_SECRET ?? "",
  /** Digest email (Resend). Without a key, digests are skipped. */
  resendKey: process.env.RESEND_API_KEY ?? "",
  digestFrom: process.env.DIGEST_FROM || "Return Agent <onboarding@resend.dev>",
  digestTo: process.env.DIGEST_TO ?? "",
  digestEveryDays: Math.max(1, Number(process.env.DIGEST_EVERY_DAYS || 2)),
  /** How far back the first sync looks. */
  initialLookbackDays: Number(process.env.SYNC_LOOKBACK_DAYS || 60),
  /** Upper bound on emails processed per sync run (keeps runs inside the function time limit). */
  maxEmailsPerSync: Number(process.env.SYNC_MAX_EMAILS || 120),
};

export interface ConfigStatus {
  gmail: boolean;
  extraction: boolean;
  digest: boolean;
  sampleDigest: boolean;
  storage: "supabase" | "local-file";
  secret: boolean;
  allowlist: boolean;
  missing: string[];
}

export function configStatus(): ConfigStatus {
  const missing: string[] = [];
  if (!env.googleClientId) missing.push("GOOGLE_CLIENT_ID");
  if (!env.googleClientSecret) missing.push("GOOGLE_CLIENT_SECRET");
  if (!env.appSecret || env.appSecret.length < 32) missing.push("APP_SECRET (32+ characters)");
  if (!env.allowedEmails.length) missing.push("ALLOWED_EMAILS");
  if (!env.anthropicKey) missing.push("ANTHROPIC_API_KEY");
  const supabase = !!(env.supabaseUrl && env.supabaseServiceKey);
  if (!supabase && process.env.VERCEL) missing.push("SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
  return {
    gmail: !!(env.googleClientId && env.googleClientSecret && env.appSecret.length >= 32 && env.allowedEmails.length),
    extraction: !!env.anthropicKey,
    digest: !!env.resendKey,
    sampleDigest: !!(env.resendKey && env.digestTo),
    storage: supabase ? "supabase" : "local-file",
    secret: env.appSecret.length >= 32,
    allowlist: env.allowedEmails.length > 0,
    missing,
  };
}
