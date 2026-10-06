"use client";

import { useState, type ReactNode } from "react";
import { Check, ExternalLink, Lock, Mail } from "lucide-react";
import { Button, DeadlineChip, ProductTile, RetailerLabel, SimulatedTag, StatusPill, cx } from "./ui";
import { useUI } from "./ui-context";
import { fmtDay, money, todayISO } from "@/lib/dates";
import { RETAILERS, retailerOf, slugify } from "@/lib/retailers";
import { useActions, useStore } from "@/lib/store";
import { attentionItems } from "@/lib/selectors";
import { buildDigest } from "@/lib/digest";
import { GMAIL_QUERIES, SHOPPING_QUERY } from "@/lib/services/email-source";
import type { EmailKind, EmailSource, Purchase } from "@/lib/types";
import { PurchaseCard } from "./PurchaseCard";

const KIND_LABEL: Record<EmailKind, string> = {
  order_confirmation: "Order",
  shipping_confirmation: "Shipping",
  delivery_notification: "Delivery",
  return_confirmation: "Return",
  refund_confirmation: "Refund",
};

function relatedEmails(emails: EmailSource[], p: Purchase): EmailSource[] {
  return emails
    .filter((e) => e.id === p.emailSourceId || (p.orderNumber && e.bodyLines.some((l) => l.includes(p.orderNumber!))))
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
}

function Highlight({ line, terms }: { line: string; terms: string[] }) {
  const hits = terms.filter((t) => t && line.includes(t));
  if (!hits.length) return <>{line || " "}</>;
  const t = hits.sort((a, b) => b.length - a.length)[0];
  const i = line.indexOf(t);
  return (
    <>
      {line.slice(0, i)}
      <mark className="rounded-md bg-[#fff1c2] px-1 py-0.5 text-ink">{t}</mark>
      <Highlight line={line.slice(i + t.length)} terms={terms} />
    </>
  );
}

export function EmailSheetBody({ id }: { id: string }) {
  const { state } = useStore();
  const p = state.purchases.find((x) => x.id === id);
  const related = p ? relatedEmails(state.emails, p) : [];
  const [active, setActive] = useState(related[related.length - 1]?.kind === "refund_confirmation" ? related.length - 1 : 0);
  if (!p) return null;
  if (!related.length) return <p className="text-muted">This purchase was added manually, so there’s no source email.</p>;
  const email = related[Math.min(active, related.length - 1)];
  const longDeadline = p.returnDeadline
    ? new Date(p.returnDeadline + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "";
  const terms = [p.orderNumber ?? "", p.itemName, p.price !== null ? money(p.price) : "", longDeadline];

  return (
    <div>
      <p className="mb-4 text-[13px] leading-relaxed text-muted">
        Return Agent read {related.length === 1 ? "this email" : `these ${related.length} emails`}.{" "}
        <mark className="rounded-md bg-[#fff1c2] px-1 text-ink">Highlighted</mark> values were extracted.
      </p>
      {related.length > 1 && (
        <div className="no-scrollbar mb-4 flex gap-1.5 overflow-x-auto">
          {related.map((e, i) => (
            <button
              key={e.id}
              onClick={() => setActive(i)}
              className={cx(
                "h-8 shrink-0 rounded-full px-3.5 text-[12px] font-medium transition",
                i === active ? "bg-ink text-white" : "bg-canvas text-ink-2 hover:bg-line-2",
              )}
            >
              {KIND_LABEL[e.kind]}
            </button>
          ))}
        </div>
      )}
      <div className="overflow-hidden rounded-[20px] border border-line">
        <div className="border-b border-line-2 bg-canvas/60 px-5 py-4">
          <div className="text-[15px] font-semibold leading-snug">{email.subject}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
            <span className="font-medium text-ink-2">{email.fromName}</span>
            {email.inboxLabel && <span className="rounded-full bg-canvas px-2 py-0.5 text-[11px]">{email.inboxLabel}</span>}
            <span>&lt;{email.fromAddress}&gt;</span>
            <span>·</span>
            <span>{fmtDay(email.receivedAt)}</span>
          </div>
        </div>
        <div className="px-5 py-4 font-[450] text-[14px] leading-[1.7] text-ink-2">
          {email.bodyLines.map((l, i) => (
            <div key={i}>
              <Highlight line={l} terms={terms} />
            </div>
          ))}
        </div>
      </div>
      <p className="mt-4 flex items-center gap-1.5 text-[12px] text-faint">
        <Mail size={13} />
        {email.provider === "demo" ? (
          "Demo email (fictional) used in place of Gmail."
        ) : (
          <>
            From your Gmail inbox.
            {email.externalMessageId && (
              <a
                className="ml-1 font-medium text-ink-2 underline underline-offset-4 hover:text-ink"
                href={`https://mail.google.com/mail/u/0/#all/${email.externalMessageId}`}
                target="_blank"
                rel="noreferrer"
              >
                Open in Gmail
              </a>
            )}
          </>
        )}
      </p>
    </div>
  );
}

export function OrderSheetBody({ id }: { id: string }) {
  const { state } = useStore();
  const { openSheet } = useUI();
  const p = state.purchases.find((x) => x.id === id);
  if (!p) return null;
  const acts = state.activities
    .filter((a) => a.purchaseId === p.id)
    .sort((a, b) => b.at.localeCompare(a.at));
  const NV = <span className="font-medium text-warn">Needs verification</span>;

  return (
    <div>
      <div className="flex items-center gap-4">
        <ProductTile purchase={p} size={72} />
        <div className="min-w-0">
          <RetailerLabel purchase={p} />
          <div className="text-[19px] font-semibold tracking-tight">{p.itemName}</div>
          <div className="text-[13px] text-muted">{p.variant}</div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <StatusPill status={p.status} />
        {["decide", "return", "return_started", "ready_to_drop_off"].includes(p.status) && <DeadlineChip purchase={p} compact />}
      </div>

      <dl className="mt-5 divide-y divide-line-2 rounded-2xl border border-line text-[14px]">
        <KV k="Price" v={p.price !== null ? money(p.price) : NV} />
        <KV k="Order number" v={p.orderNumber ? `#${p.orderNumber}` : NV} />
        <KV k="Order date" v={p.orderDate ? fmtDay(p.orderDate) : NV} />
        <KV
          k="Return by"
          v={
            !p.returnDeadline && ["decide", "keep", "return", "return_started", "ready_to_drop_off"].includes(p.status) ? (
              <SetDeadline id={p.id} />
            ) : p.returnDeadline ? (
              <span className="text-right">
                {fmtDay(p.returnDeadline)}
                <span className="block text-[11px] font-normal text-muted">
                  {p.deadlineSource.kind === "verified" ? p.deadlineSource.note : ""}
                </span>
              </span>
            ) : (
              NV
            )
          }
        />
        <KV k="Source" v={p.origin === "manual" ? "Added manually" : "Order confirmation email"} />
      </dl>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {p.emailSourceId && (
          <Button variant="secondary" onClick={() => openSheet({ kind: "email", id: p.id })}>
            <Mail size={15} />
            Source email
          </Button>
        )}
        {p.orderUrl && (
          <a
            href={p.orderUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-line px-5 text-sm font-medium hover:bg-canvas"
          >
            {retailerOf(p).domain}
            <ExternalLink size={14} />
          </a>
        )}
      </div>

      {acts.length > 0 && (
        <div className="mt-7">
          <div className="mb-3 text-[13px] font-medium text-muted">What Return Agent did</div>
          <ul className="flex flex-col gap-3">
            {acts.map((a) => (
              <li key={a.id} className="flex items-start gap-3 text-[14px]">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-money-bg text-money">
                  <Check size={11} strokeWidth={3} />
                </span>
                <span className="flex-1">{a.message}</span>
                {a.simulated && <SimulatedTag />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}

export function ReviewSheetBody() {
  const { state } = useStore();
  const items = attentionItems(state);
  if (!items.length)
    return (
      <div className="py-8 text-center">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-money-bg text-money">
          <Check size={22} />
        </div>
        <div className="text-[16px] font-medium">You’re all caught up</div>
        <p className="mt-1 text-[14px] text-muted">No return deadlines in the next 7 days.</p>
      </div>
    );
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[14px] text-ink-2">Most urgent first. Decide now and Return Agent handles the rest.</p>
      {items.map((p) => (
        <PurchaseCard key={p.id} purchase={p} />
      ))}
    </div>
  );
}

export function PrivacySheetBody() {
  return (
    <div className="flex flex-col gap-5 text-[14px] leading-relaxed text-ink-2">
      <div className="flex items-start gap-3 rounded-2xl bg-canvas p-4">
        <Lock size={18} className="mt-0.5 shrink-0 text-money" />
        Return Agent searches only for shopping-related emails needed to manage purchases and returns. It never sends,
        deletes or changes email, and never reads personal conversations.
      </div>
      <div>
        <div className="mb-2 font-medium text-ink">What it looks for</div>
        <ul className="flex flex-col gap-1.5">
          {(Object.keys(GMAIL_QUERIES) as EmailKind[]).map((k) => (
            <li key={k} className="flex items-center gap-2">
              <Check size={14} className="text-money" />
              {GMAIL_QUERIES[k]}
            </li>
          ))}
        </ul>
        <div className="mb-1 mt-4 text-[12px] font-medium text-ink">The exact Gmail search</div>
        <code className="block break-words rounded-xl border border-line bg-canvas px-3 py-2 text-[11px] text-muted">
          {SHOPPING_QUERY}
        </code>
        <p className="mt-2 text-[12px] text-muted">
          Matching emails are read by Claude to pull out order details. Emails that turn out not to be shopping are
          discarded and not stored.
        </p>
      </div>
      <div>
        <div className="mb-1 font-medium text-ink">Always shows its work</div>
        Every purchase links to the email it came from. Anything the agent couldn’t confirm is marked “Needs
        verification” rather than guessed. Simulated steps are labeled Simulated.
      </div>
      <div>
        <div className="mb-1 font-medium text-ink">Asks before acting</div>
        Return Agent asks for confirmation before starting a return or marking something dropped off.
      </div>
    </div>
  );
}

const KNOWN_RETAILERS = Object.values(RETAILERS);

export function AddPurchaseBody() {
  const { addPurchase } = useActions();
  const { closeSheet } = useUI();
  const [f, setF] = useState({
    retailer: "",
    item: "",
    price: "",
    orderDate: todayISO(),
    orderNumber: "",
    deadline: "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.value });
  const valid = f.retailer.trim() && f.item.trim();

  const submit = () => {
    const name = f.retailer.trim();
    if (!name) return;
    const known = KNOWN_RETAILERS.find((r) => r.name.toLowerCase() === name.toLowerCase());
    const price = f.price ? Number(f.price) : null;
    const unverified: (keyof Purchase)[] = [];
    if (price === null || Number.isNaN(price)) unverified.push("price");
    if (!f.deadline) unverified.push("returnDeadline");
    addPurchase({
      id: `p_manual_${Date.now().toString(36)}`,
      userId: "user_demo",
      retailer: known?.id ?? slugify(name),
      retailerName: known?.name ?? name,
      retailerDomain: known?.domain ?? null,
      itemName: f.item.trim(),
      variant: null,
      category: "top",
      imageUrl: null,
      tint: "#EFEEEA",
      price: price === null || Number.isNaN(price) ? null : price,
      currency: "USD",
      orderNumber: f.orderNumber.trim() || null,
      orderDate: f.orderDate || null,
      orderUrl: known ? `https://www.${known.domain}` : null,
      emailSourceId: null,
      returnDeadline: f.deadline || null,
      deadlineSource: f.deadline ? { kind: "verified", note: "Entered by you" } : { kind: "needs_verification" },
      status: "decide",
      unverifiedFields: unverified,
      origin: "manual",
      createdAt: new Date().toISOString(),
    });
    closeSheet();
  };

  const input = "h-12 w-full rounded-2xl border border-line bg-white px-4 text-[15px] outline-none transition focus:border-ink";
  return (
    <div>
      <p className="mb-5 text-[14px] leading-relaxed text-muted">
        Return Agent usually finds purchases in your email automatically. Add one here if it came from a store or a
        different inbox.
      </p>
      <div className="flex flex-col gap-3.5">
        <Field label="Retailer">
          <input
            className={input}
            id="add-retailer"
            list="known-retailers"
            value={f.retailer}
            onChange={set("retailer")}
            placeholder="e.g. Nordstrom"
          />
          <datalist id="known-retailers">
            {KNOWN_RETAILERS.map((r) => (
              <option key={r.id} value={r.name} />
            ))}
          </datalist>
        </Field>
        <Field label="Item">
          <input className={input} value={f.item} onChange={set("item")} placeholder="e.g. Cropped Cardigan" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Price">
            <input className={input} value={f.price} onChange={set("price")} placeholder="$0.00" inputMode="decimal" />
          </Field>
          <Field label="Order date">
            <input className={input} type="date" value={f.orderDate} onChange={set("orderDate")} />
          </Field>
        </div>
        <Field label="Order number" optional>
          <input className={input} value={f.orderNumber} onChange={set("orderNumber")} placeholder="Optional" />
        </Field>
        <Field label="Return deadline" optional>
          <input className={input} type="date" value={f.deadline} onChange={set("deadline")} />
          <span className="mt-1.5 block text-[12px] text-muted">
            Leave blank if you’re not sure. It will be marked “Needs verification”.
          </span>
        </Field>
      </div>
      <Button size="lg" className="mt-6 w-full" disabled={!valid} onClick={submit}>
        Add purchase
      </Button>
    </div>
  );
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink-2">
        {label}
        {optional && <span className="font-normal text-faint"> · optional</span>}
      </span>
      {children}
    </label>
  );
}


export function AccountSheetBody() {
  const { state, sync, runSync, server } = useStore();
  const { openSheet } = useUI();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const a = state.account;

  const post = async (url: string) => {
    setBusy(true);
    await fetch(url, { method: "POST" }).catch(() => undefined);
    // Full reload on purpose: session cookie changed.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/");
  };

  return (
    <div className="flex flex-col gap-5 text-[14px]">
      <dl className="divide-y divide-line-2 rounded-2xl border border-line">
        <KV k="Gmail" v={a?.email ?? "Not connected"} />
        <KV k="Last sync" v={a?.lastSyncedAt ? new Date(a.lastSyncedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "Never"} />
        <KV k="Access" v="Read-only" />
        <KV k="Stored in" v={server?.storage === "supabase" ? "Your Supabase database" : "A file on this computer"} />
      </dl>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => runSync()} disabled={sync.running}>
          {sync.running ? "Syncing…" : "Sync now"}
        </Button>
        <Button variant="secondary" onClick={() => openSheet({ kind: "privacy" })}>
          What it reads
        </Button>
      </div>
      <p className="text-[13px] leading-relaxed text-muted">
        Return Agent checks Gmail automatically once a day when it’s deployed with the daily job. You can also sync any
        time.
      </p>
      <div className="flex flex-col gap-2 border-t border-line-2 pt-5">
        <Button variant="ghost" onClick={() => post("/api/auth/logout")} disabled={busy}>
          Sign out on this device
        </Button>
        {confirmDelete ? (
          <div className="rounded-2xl bg-urgent-bg p-4">
            <p className="font-medium text-urgent">Disconnect Gmail and delete everything?</p>
            <p className="mt-1 text-[13px] text-ink-2">
              This revokes Return Agent’s Gmail access and deletes all purchases, emails and history it stored. It can’t
              be undone.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={() => post("/api/auth/disconnect")} disabled={busy}>
                Delete everything
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" className="text-urgent" onClick={() => setConfirmDelete(true)}>
            Disconnect Gmail and delete data
          </Button>
        )}
      </div>
    </div>
  );
}

function SetDeadline({ id }: { id: string }) {
  const { setDeadline } = useActions();
  const [date, setDate] = useState("");
  return (
    <span className="flex flex-col items-end gap-1.5">
      <span className="font-medium text-warn">Needs verification</span>
      <span className="flex items-center gap-1.5">
        <input
          id={`deadline-${id}`}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-8 rounded-lg border border-line px-2 text-[12px] font-normal"
          aria-label="Return deadline"
        />
        <Button size="sm" variant="secondary" className="h-8 px-3" disabled={!date} onClick={() => setDeadline(id, date)}>
          Set
        </Button>
      </span>
      <span className="text-[11px] font-normal text-muted">Check the retailer’s return policy, then set it here.</span>
    </span>
  );
}

export function DigestSheetBody() {
  const { state, server } = useStore();
  const [status, setStatus] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const live = state.mode === "live";
  const every = 2;
  // The sample button is for the site owner only: visit the site once with ?owner=1 to reveal it.
  const [owner] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      if (new URLSearchParams(window.location.search).get("owner") === "1") localStorage.setItem("ra-owner", "1");
      return localStorage.getItem("ra-owner") === "1";
    } catch {
      return false;
    }
  });

  const sendSample = async () => {
    setSending(true);
    setStatus(null);
    try {
      const r = await fetch("/api/digest/sample", { method: "POST" });
      const j = (await r.json()) as { sent: boolean; reason?: string; detail?: string };
      if (j.sent) setStatus({ tone: "ok", text: "Sample sent. Check your inbox (and spam) in about a minute." });
      else if (j.reason === "not_configured")
        setStatus({ tone: "err", text: "Add RESEND_API_KEY and DIGEST_TO in Vercel, then redeploy." });
      else setStatus({ tone: "err", text: j.detail ?? "Couldn’t send the sample." });
    } catch {
      setStatus({ tone: "err", text: "Couldn’t reach the server." });
    }
    setSending(false);
  };
  const digest = buildDigest(state, {
    appUrl: typeof window !== "undefined" ? window.location.origin : "",
    since: null,
    everyDays: every,
  });

  const sendNow = async () => {
    setSending(true);
    setStatus(null);
    try {
      const r = await fetch("/api/digest/send", { method: "POST" });
      const j = (await r.json()) as { sent: boolean; to?: string; reason?: string; detail?: string };
      if (j.sent) setStatus({ tone: "ok", text: `Sent to ${j.to}. Check your inbox.` });
      else if (j.reason === "not_configured")
        setStatus({ tone: "err", text: "Email isn’t turned on yet. Add RESEND_API_KEY in Vercel (see SETUP.md)." });
      else setStatus({ tone: "err", text: j.detail ?? "Couldn’t send the digest." });
    } catch {
      setStatus({ tone: "err", text: "Couldn’t reach the server." });
    }
    setSending(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-canvas p-4 text-[14px] leading-relaxed text-ink-2">
        Return Agent works in the background. Every morning it checks your inbox. Every {every} days it emails you a short
        digest, and sooner if a return is due within 2 days. Quiet days send nothing.
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
        <span className="text-muted">
          {live ? "Preview of your next digest" : "What the digest looks like for the demo inbox"}
          {!digest.shouldSend && " · nothing to report right now, so none would be sent"}
        </span>
        {!live && owner && (
          <Button size="sm" onClick={sendSample} disabled={sending}>
            <Mail size={14} />
            {sending ? "Sending…" : "Send a sample to me"}
          </Button>
        )}
        {live && (
          <Button size="sm" onClick={sendNow} disabled={sending || server?.digest === false}>
            <Mail size={14} />
            {sending ? "Sending…" : "Send me one now"}
          </Button>
        )}
      </div>
      {live && server?.digest === false && (
        <p className="text-[12px] text-muted">Email isn’t turned on yet. Add RESEND_API_KEY in Vercel (see SETUP.md).</p>
      )}
      {status && <p className={cx("text-[13px]", status.tone === "ok" ? "text-money" : "text-urgent")}>{status.text}</p>}
      <div className="overflow-hidden rounded-2xl border border-line">
        <div className="border-b border-line-2 bg-canvas/60 px-4 py-2.5 text-[12px] text-muted">
          <span className="font-medium text-ink-2">Return Agent: {digest.subject}</span>
          <span className="block truncate">{digest.preheader}</span>
        </div>
        <iframe title="Digest preview" srcDoc={digest.html} sandbox="" className="h-[560px] w-full bg-canvas" />
      </div>
    </div>
  );
}
