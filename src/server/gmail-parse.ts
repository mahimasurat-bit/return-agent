/**
 * Turns a raw Gmail API message into plain text the extractor can read.
 * Pure functions, no network, so they're easy to test.
 */
import type { GmailMessage, GmailPart } from "./google";

export interface ParsedEmail {
  messageId: string;
  threadId: string;
  fromName: string;
  fromAddress: string;
  subject: string;
  receivedAt: string; // ISO
  text: string;
  images: { src: string; alt: string }[];
  labels: string[];
}

const MAX_TEXT = 14_000;

function header(part: GmailPart, name: string) {
  return part.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decode(data?: string) {
  if (!data) return "";
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function collect(part: GmailPart, mime: string, out: string[]) {
  if (part.mimeType === mime && part.body?.data && !part.filename) out.push(decode(part.body.data));
  for (const p of part.parts ?? []) collect(p, mime, out);
}

const ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  copy: "©",
  reg: "®",
  trade: "™",
  zwnj: "",
  zwj: "",
};

export function decodeEntities(s: string) {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function htmlToText(html: string): { text: string; images: { src: string; alt: string }[] } {
  const images: { src: string; alt: string }[] = [];
  let s = html
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  s = s.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    const alt = decodeEntities(/\balt\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] ?? "").trim();
    const w = Number(/\bwidth\s*=\s*["']?(\d+)/i.exec(tag)?.[1] ?? 999);
    const looksLikeCode = /qr|barcode|return.?code|label/i.test(src ?? "") || /qr|barcode|return code/i.test(alt);
    if (
      src &&
      src.startsWith("https://") &&
      (alt || looksLikeCode) &&
      w >= 50 &&
      !/logo|spacer|pixel|icon|facebook|instagram|twitter|tiktok|pinterest|youtube/i.test(src + alt)
    ) {
      // Return QR codes often have no alt text; label them so the extractor can recognize them.
      images.push({ src, alt: alt || (looksLikeCode ? "QR / barcode image" : "") });
    }
    return " ";
  });

  // Keep useful link targets (order / tracking / returns) inline so the extractor can cite them.
  s = s.replace(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, inner: string) => {
    const label = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (/order|track|return|refund|label/i.test(label) && href.startsWith("https://") && href.length < 300) {
      return ` ${label} [${decodeEntities(href)}] `;
    }
    return ` ${label} `;
  });

  s = s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|table|section|header|footer)>/gi, "\n")
    .replace(/<\/(td|th)>/gi, "  ")
    .replace(/<[^>]+>/g, " ");

  const text = decodeEntities(s)
    .replace(/[​-‍­͏﻿]/g, "")
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .filter((l, i, arr) => l || (i > 0 && arr[i - 1]))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text, images: dedupeImages(images).slice(0, 15) };
}

function dedupeImages(xs: { src: string; alt: string }[]) {
  const seen = new Set<string>();
  return xs.filter((x) => (seen.has(x.src) ? false : (seen.add(x.src), true)));
}

export function parseFrom(v: string): { name: string; address: string } {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(v);
  if (m) return { name: m[1].trim() || m[2], address: m[2].trim().toLowerCase() };
  return { name: v.trim(), address: v.trim().toLowerCase() };
}

export function parseGmailMessage(m: GmailMessage): ParsedEmail {
  const plain: string[] = [];
  const html: string[] = [];
  collect(m.payload, "text/plain", plain);
  collect(m.payload, "text/html", html);

  let text = "";
  let images: ParsedEmail["images"] = [];
  if (html.length) {
    const r = htmlToText(html.join("\n"));
    text = r.text;
    images = r.images;
  }
  // Prefer the plain part when it's substantial; HTML-only emails fall back to the converted HTML.
  const plainText = plain.join("\n").trim();
  if (plainText.length > 200 && plainText.length >= text.length * 0.4) text = plainText;
  if (!text) text = m.snippet ?? "";

  const from = parseFrom(header(m.payload, "From"));
  return {
    messageId: m.id,
    threadId: m.threadId,
    fromName: from.name,
    fromAddress: from.address,
    subject: decodeEntities(header(m.payload, "Subject")),
    receivedAt: new Date(Number(m.internalDate)).toISOString(),
    text: text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) + "\n[…truncated]" : text,
    images,
    labels: m.labelIds ?? [],
  };
}
