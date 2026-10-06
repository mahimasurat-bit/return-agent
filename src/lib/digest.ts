/**
 * The Return Agent digest: a short email that says only what needs you.
 * Pure function so the server (cron) and the browser (preview) build the same thing.
 */
import { daysUntil, fmtDay, money } from "./dates";
import type { DataState } from "./domain";
import { retailerOf, RETURN_METHODS } from "./retailers";
import { attentionItems, dropOffGroups, refundRows, summary } from "./selectors";
import type { Purchase, Return } from "./types";

export interface DigestOptions {
  appUrl: string;
  /** Purchases created after this time are listed as new. */
  since: string | null;
  everyDays: number;
}

export interface Digest {
  /** False on quiet days: nothing new, nothing urgent. The agent stays silent. */
  shouldSend: boolean;
  /** Something is due within 2 days: send even between scheduled digests. */
  urgent: boolean;
  subject: string;
  preheader: string;
  html: string;
  text: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function due(p: Purchase) {
  if (!p.returnDeadline) return "deadline needs verification";
  const d = daysUntil(p.returnDeadline);
  return d === 0 ? "due today" : d === 1 ? "due tomorrow" : `due ${fmtDay(p.returnDeadline)} (${d} days)`;
}

export function buildDigest(data: DataState, o: DigestOptions): Digest {
  const gmailLink = (emailId: string | null | undefined) => {
    const e = emailId ? data.emails.find((x) => x.id === emailId) : undefined;
    return e?.provider === "gmail" && e.externalMessageId ? `https://mail.google.com/mail/u/0/#all/${e.externalMessageId}` : null;
  };
  const s = summary(data);
  const attention = attentionItems(data);
  const trips = dropOffGroups(data);
  const trip = trips[0];
  const otherTrips = trips.slice(1);
  const overdue = refundRows(data).filter((r) => r.overdue);
  const fresh = o.since
    ? data.purchases.filter((p) => p.status === "decide" && p.createdAt > o.since! && !attention.includes(p))
    : [];
  const urgent = attention.some((p) => p.returnDeadline && daysUntil(p.returnDeadline) <= 2);
  const shouldSend = attention.length > 0 || fresh.length > 0 || overdue.length > 0;

  // Subject leads with the most important thing.
  const subject = attention.length
    ? `${attention.length} ${attention.length === 1 ? "return" : "returns"} due soon · ${money(s.atRiskValue)} at risk`
    : overdue.length
      ? `${overdue.length === 1 ? "A refund looks" : `${overdue.length} refunds look`} overdue`
      : fresh.length
        ? `${fresh.length} new ${fresh.length === 1 ? "purchase" : "purchases"} to decide on`
        : "All clear on your returns";
  const preheader = trip
    ? `Best next step: one ${trip.label} trip, ${trip.items.length} ${trip.items.length === 1 ? "item" : "items"}, ${money(trip.total)} back.`
    : `${money(s.pendingValue)} waiting to be returned.`;

  /* ── Text version ── */
  const t: string[] = [`RETURN AGENT`, subject, ""];
  if (attention.length) {
    t.push("DUE SOON");
    for (const p of attention) t.push(`- ${retailerOf(p).name} ${p.itemName}, ${money(p.price)}, ${due(p)}`);
    t.push("");
  }
  if (trip) {
    t.push(`YOUR BEST TRIP: ${trip.label}`);
    for (const { purchase, ret } of trip.items) {
      t.push(`- ${retailerOf(purchase).name} ${purchase.itemName}${ret.artifact?.code ? `  ·  code ${ret.artifact.code}` : ""}`);
      const link = gmailLink(ret.emailSourceId);
      if (link) t.push(`  Return email: ${link}`);
    }
    t.push(`${money(trip.total)} back`, "");
  }
  if (overdue.length) {
    t.push("REFUNDS TO CHASE");
    for (const r of overdue) t.push(`- ${r.purchase.itemName}, ${money(r.refund.amount)}, dropped off ${r.daysSinceDropOff} days ago`);
    t.push("");
  }
  if (fresh.length) {
    t.push("NEW PURCHASES");
    for (const p of fresh) t.push(`- ${retailerOf(p).name} ${p.itemName}, ${money(p.price)}`);
    t.push("");
  }
  t.push(`Open Return Agent: ${o.appUrl}`, "", `You get this every ${o.everyDays} days, only when something needs you.`);

  /* ── HTML version (inline styles for email clients) ── */
  const C = { ink: "#111111", muted: "#75756f", line: "#e7e6e1", bg: "#f6f6f3", urgent: "#c0362c", warn: "#a35a00", money: "#1d7a4c" };
  const row = (left: string, right: string, sub?: string, tone?: string) => `
    <tr><td style="padding:12px 0;border-top:1px solid ${C.line}">
      <div style="font-size:15px;font-weight:600;color:${C.ink}">${left}</div>
      ${sub ? `<div style="font-size:13px;color:${tone ?? C.muted};margin-top:2px">${sub}</div>` : ""}
    </td><td align="right" style="padding:12px 0;border-top:1px solid ${C.line};font-size:15px;font-weight:600;color:${C.ink};white-space:nowrap">${right}</td></tr>`;
  const section = (title: string, rows: string) => `
    <tr><td style="padding:24px 28px 0">
      <div style="font-size:11px;letter-spacing:1.6px;font-weight:700;color:${C.muted};text-transform:uppercase;margin-bottom:6px">${title}</div>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${rows}</table>
    </td></tr>`;
  const label = (p: Purchase) => `${esc(retailerOf(p).name)} · ${esc(p.itemName)}`;

  /** The code to show at the counter: retailer's own image if we have it, else a QR made from the code. */
  function codeBlock(p: Purchase, ret: Return) {
    const a = ret.artifact;
    if (!a?.code) return "";
    const demo = ret.simulated || data.emails.find((e) => e.id === ret.emailSourceId)?.provider === "demo";
    const link = gmailLink(ret.emailSourceId);
    const img = a.imageUrl ?? (a.type !== "label" && o.appUrl ? `${o.appUrl.replace(/\/$/, "")}/api/qr?d=${encodeURIComponent(a.code)}` : null);
    const note = demo
      ? "Demo code · not a real return code"
      : a.imageUrl
        ? `From your ${esc(retailerOf(p).name)} return email`
        : a.type === "label"
          ? "Printable label: open the return email"
          : "Made from the code in your return email";
    return `<tr><td colspan="2" style="padding:0 0 14px">
      <table cellpadding="0" cellspacing="0" role="presentation" style="background:${C.bg};border-radius:14px;width:100%"><tr>
        ${img ? `<td width="132" style="padding:12px"><img src="${esc(img)}" width="120" height="120" alt="Return code ${esc(a.code)}" style="display:block;border-radius:8px;background:#fff"></td>` : ""}
        <td style="padding:12px ${img ? "12px 12px 0" : "16px"}">
          <div style="font-family:Menlo,Consolas,monospace;font-size:15px;font-weight:600;color:${C.ink};letter-spacing:0.5px">${esc(a.code)}</div>
          ${a.trackingNumber ? `<div style="font-size:12px;color:${C.muted};margin-top:2px">Tracking ${esc(a.trackingNumber)}</div>` : ""}
          <div style="font-size:12px;color:${C.muted};margin-top:6px">${note}</div>
          ${link ? `<a href="${esc(link)}" style="display:inline-block;margin-top:8px;font-size:13px;font-weight:600;color:${C.ink}">Open return email</a>` : ""}
        </td>
      </tr></table>
    </td></tr>`;
  }

  let body = "";
  if (attention.length)
    body += section(
      "Due soon",
      attention
        .map((p) => {
          const d = p.returnDeadline ? daysUntil(p.returnDeadline) : 99;
          return row(label(p), money(p.price), esc(due(p)) + (p.status === "decide" ? " · decide: return or keep" : ""), d <= 4 ? C.urgent : C.warn);
        })
        .join(""),
    );
  if (trip)
    body += section(
      `Your best trip · ${esc(trip.label)}`,
      trip.items.map(({ purchase, ret }) => row(label(purchase), money(purchase.price)) + codeBlock(purchase, ret)).join("") +
        row(`${trip.items.length} ${trip.items.length === 1 ? "item" : "items"}, one stop`, `<span style="color:${C.money}">${money(trip.total)} back</span>`,
          trip.methodId === "other" ? undefined : esc(RETURN_METHODS[trip.methodId].instructions)),
    ) +
    (otherTrips.length
      ? `<tr><td style="padding:8px 28px 0;font-size:13px;color:${C.muted}">Also ready: ${otherTrips
          .map((g) => `${esc(g.label)} · ${g.items.length} ${g.items.length === 1 ? "item" : "items"}`)
          .join(", ")}. Codes are in the app.</td></tr>`
      : "");
  if (overdue.length)
    body += section(
      "Refunds to chase",
      overdue.map((r) => row(label(r.purchase), money(r.refund.amount), `Dropped off ${r.daysSinceDropOff} days ago, no refund yet`, C.urgent)).join(""),
    );
  if (fresh.length) body += section("New purchases", fresh.map((p) => row(label(p), money(p.price), esc(due(p)))).join(""));

  const html = `<!doctype html><html><body style="margin:0;background:${C.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</span>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${C.bg};padding:24px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;background:#ffffff;border:1px solid ${C.line};border-radius:20px">
  <tr><td style="padding:28px 28px 0">
    <div style="font-size:13px;font-weight:600;color:${C.ink}">↩ Return Agent</div>
    <div style="font-size:24px;line-height:1.25;font-weight:700;color:${C.ink};margin-top:14px">${esc(subject)}</div>
    <div style="font-size:15px;color:${C.muted};margin-top:6px">${esc(preheader)}</div>
  </td></tr>
  ${body}
  <tr><td style="padding:24px 28px 28px">
    <a href="${esc(o.appUrl)}" style="display:inline-block;background:${C.ink};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:999px">Open Return Agent</a>
    <div style="font-size:12px;color:${C.muted};margin-top:18px;line-height:1.5">
      ${money(s.pendingValue)} waiting to be returned · ${money(s.refundsWaitingValue)} in refunds on the way.<br>
      You get this every ${o.everyDays} days, and sooner if something is due within 2 days. Quiet days send nothing.
    </div>
  </td></tr>
</table></td></tr></table></body></html>`;

  return { shouldSend, urgent, subject, preheader, html, text: t.join("\n") };
}

/** Should the scheduled job send today? */
export function digestDue(lastSentAt: string | null, everyDays: number, urgent: boolean, now = new Date()): boolean {
  if (!lastSentAt) return true;
  const hours = (now.getTime() - new Date(lastSentAt).getTime()) / 3_600_000;
  if (urgent && hours >= 20) return true; // at most once a day for urgent items
  return hours >= everyDays * 24 - 2; // small slack so a daily cron lands on the right day
}

