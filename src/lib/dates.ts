/**
 * Demo mode pins "today" so the fixture deadlines stay coherent whenever the
 * demo runs. Live mode (real Gmail) and the server always use the real clock.
 */
const DEMO_TODAY = process.env.NEXT_PUBLIC_DEMO_TODAY || "2026-10-05";
let pinned: string | null = null;

export function setDemoClock(on: boolean) {
  pinned = on ? DEMO_TODAY : null;
}

export function today(): Date {
  if (pinned) return parseDay(pinned);
  if (typeof window === "undefined") {
    // Server (Vercel runs in UTC): use the owner's timezone for calendar days.
    const tz = process.env.APP_TIMEZONE || "America/Los_Angeles";
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    return parseDay(parts);
  }
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

export function todayISO(): string {
  return toISODay(today());
}

export function nowISO(): string {
  // Keep activity timestamps on the demo day, with the real time of day.
  const t = today();
  const n = new Date();
  t.setHours(n.getHours(), n.getMinutes(), n.getSeconds());
  return t.toISOString();
}

export function parseDay(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toISODay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function daysUntil(day: string): number {
  const ms = parseDay(day).getTime() - today().getTime();
  return Math.round(ms / 86_400_000);
}

export function daysSince(day: string): number {
  return -daysUntil(day);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtDay(day: string | null): string {
  if (!day) return "Unknown";
  const d = parseDay(day);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function relativeDays(n: number): string {
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  if (n < 0) return `${-n} days ago`;
  return `${n} days left`;
}

export function money(n: number | null, opts: { cents?: boolean } = {}): string {
  if (n === null) return "—";
  const cents = opts.cents ?? n % 1 !== 0;
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
}
