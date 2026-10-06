"use client";

import { useState } from "react";
import { ArrowRight, Check, Lock, Mail, ShieldCheck } from "lucide-react";
import { Button, Logo, Sheet } from "./ui";
import { useActions, useStore } from "@/lib/store";

const SEARCHES = [
  "Order confirmations",
  "Shipping and delivery updates",
  "Return confirmations and labels",
  "Refund confirmations",
];

const AUTH_ERRORS: Record<string, string> = {
  not_allowed: "That Google account isn’t on this Return Agent’s allowed list (ALLOWED_EMAILS).",
  access_denied: "Google access was cancelled. Return Agent needs read-only Gmail access to find purchases.",
  scope_missing: "Gmail access wasn’t granted. On the Google screen, check the box to allow reading email.",
  no_refresh_token: "Google didn’t return offline access. Remove Return Agent at myaccount.google.com/permissions and connect again.",
  not_configured: "Gmail isn’t set up on this server yet.",
  bad_state: "The sign-in link expired. Try connecting again.",
  token_exchange: "Google rejected the sign-in. Check the OAuth client ID, secret and redirect URI.",
  no_email: "Google didn’t share a verified email address.",
};

/** OAuth starts at an API route, so this must be a full page navigation. */
function reconnect() {
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign("/api/auth/google");
}

export function Onboarding() {
  const { startDemo } = useActions();
  const { server, authError } = useStore();
  const [consentOpen, setConsentOpen] = useState(false);
  const gmailReady = !!server?.gmail;

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-5 sm:px-8">
        <header className="flex items-center gap-2.5 py-6">
          <Logo size={30} />
          <span className="text-[15px] font-semibold tracking-tight">Return Agent</span>
        </header>

        <div className="grid flex-1 items-center gap-14 pb-16 pt-6 lg:grid-cols-[1.1fr_1fr] lg:pt-0">
          <div className="animate-fade-up">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-[12px] text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-money" />
              Your personal returns agent
            </p>
            <h1 className="text-[44px] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-[64px]">
              Never miss a<br />return again.
            </h1>
            <p className="mt-6 max-w-[30rem] text-[17px] leading-relaxed text-ink-2">
              Return Agent finds your purchases, tracks return deadlines, organizes your returns, and makes sure you get
              your money back.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              {gmailReady ? (
                <>
                  <Button size="lg" onClick={() => setConsentOpen(true)} className="sm:w-auto">
                    <Mail size={18} />
                    Connect Gmail
                  </Button>
                  <Button size="lg" variant="ghost" onClick={startDemo}>
                    Try with demo purchases
                    <ArrowRight size={16} />
                  </Button>
                </>
              ) : (
                <>
                  {/* Preview site (no Gmail configured): one clear path in. */}
                  <Button size="lg" onClick={startDemo} className="sm:w-auto">
                    Try it with a sample inbox
                    <ArrowRight size={17} />
                  </Button>
                  <Button size="lg" variant="ghost" onClick={() => setConsentOpen(true)}>
                    <Mail size={17} />
                    How Gmail connection works
                  </Button>
                </>
              )}
            </div>
            {authError && (
              <p className="mt-5 max-w-md rounded-2xl bg-urgent-bg px-4 py-3 text-[13px] leading-relaxed text-urgent">
                {AUTH_ERRORS[authError] ?? "Gmail connection didn’t finish. Try again."}
              </p>
            )}
            <p className="mt-5 flex max-w-md items-start gap-2 text-[13px] leading-relaxed text-muted">
              <Lock size={14} className="mt-0.5 shrink-0" />
              Return Agent only looks for purchase, shipping, return, and refund emails.
            </p>
          </div>

          <PreviewStack />
        </div>
      </div>

      <Sheet open={consentOpen} onClose={() => setConsentOpen(false)} title="Connect Gmail">
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3 rounded-2xl bg-canvas p-4">
            <ShieldCheck className="shrink-0 text-money" size={22} />
            <p className="text-[14px] leading-snug text-ink-2">
              Read-only access. Return Agent never sends, deletes, or changes your email.
            </p>
          </div>
          <div>
            <p className="mb-3 text-[13px] font-medium text-muted">Return Agent searches only for</p>
            <ul className="flex flex-col gap-2.5">
              {SEARCHES.map((s) => (
                <li key={s} className="flex items-center gap-3 text-[15px]">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-money-bg text-money">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  {s}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[13px] leading-relaxed text-muted">
              Personal conversations are never read. Every purchase links back to the email it came from, so you can
              always see where the agent got its information.
            </p>
          </div>

          {gmailReady ? (
            <Button size="lg" onClick={reconnect}>
              Continue with Google
            </Button>
          ) : (
            <>
              <div className="rounded-2xl border border-dashed border-line p-4 text-[13px] leading-relaxed text-muted">
                <span className="font-medium text-ink">This preview uses a sample inbox.</span> Try the full experience
                with realistic demo purchases, without sharing your email.
                {process.env.NODE_ENV !== "production" && server?.missing.length ? (
                  <span className="mt-2 block font-mono text-[11px] text-faint">
                    Dev note: missing {server.missing.join(", ")} (see SETUP.md)
                  </span>
                ) : null}
              </div>
              <Button size="lg" onClick={startDemo}>
                Continue with demo inbox
              </Button>
            </>
          )}
        </div>
      </Sheet>
    </main>
  );
}

function PreviewStack() {
  const rows = [
    { r: "NIKE", n: "Pegasus 41", p: "$160", d: "4 days left", tone: "text-urgent bg-urgent-bg", tint: "#EEF0F2" },
    { r: "LULULEMON", n: "Align Jacket", p: "$148", d: "6 days left", tone: "text-warn bg-warn-bg", tint: "#F2EEE7" },
    { r: "HOKA", n: "Clifton 10", p: "$145", d: "Ready to drop off", tone: "text-info bg-info-bg", tint: "#EEF2F4" },
  ];
  return (
    <div className="relative mx-auto w-full max-w-[420px] animate-fade-up [animation-delay:120ms]">
      <div className="rounded-[28px] border border-line bg-white p-5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.18)]">
        <div className="mb-4 flex items-center gap-2 text-[12px] text-muted">
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 rounded-full bg-money animate-ping-soft" />
            <span className="relative h-2 w-2 rounded-full bg-money" />
          </span>
          Return Agent found 3 things to handle
        </div>
        <div className="mb-5">
          <div className="text-[13px] text-muted">Waiting to be returned</div>
          <div className="tabular text-[44px] font-semibold tracking-[-0.03em]">$453</div>
        </div>
        <div className="flex flex-col divide-y divide-line-2">
          {rows.map((x) => (
            <div key={x.n} className="flex items-center gap-3 py-3">
              <div className="h-11 w-11 rounded-xl" style={{ background: x.tint }} />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold tracking-[0.16em] text-muted">{x.r}</div>
                <div className="truncate text-[15px] font-medium">{x.n}</div>
              </div>
              <div className="text-right">
                <div className="tabular text-[15px] font-medium">{x.p}</div>
                <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${x.tone}`}>{x.d}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute -bottom-5 left-6 right-6 -z-10 h-full rounded-[28px] border border-line bg-white/60" />
    </div>
  );
}
