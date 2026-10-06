"use client";

import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import { X } from "lucide-react";
import { daysUntil, fmtDay, relativeDays } from "@/lib/dates";
import { retailerOf } from "@/lib/retailers";
import type { Purchase, PurchaseStatus } from "@/lib/types";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* ── Buttons ─────────────────────────────────────────────── */

type Variant = "primary" | "secondary" | "ghost" | "inverse" | "danger";
export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg" }) {
  return (
    <button
      {...rest}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium transition active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap",
        size === "sm" && "h-9 px-4 text-[13px]",
        size === "md" && "h-11 px-5 text-sm",
        size === "lg" && "h-13 px-7 text-[15px]",
        variant === "primary" && "bg-ink text-white hover:bg-black",
        variant === "secondary" && "bg-white text-ink border border-line hover:border-[#d6d5cf] hover:bg-[#fbfbf9]",
        variant === "ghost" && "text-ink-2 hover:bg-black/[0.04]",
        variant === "inverse" && "bg-white text-ink hover:bg-white/90",
        variant === "danger" && "bg-urgent text-white hover:opacity-90",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TextLink({ children, onClick, className }: { children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={cx("text-[13px] text-muted hover:text-ink underline-offset-4 hover:underline transition", className)}
    >
      {children}
    </button>
  );
}

/* ── Sheet (bottom sheet on mobile, centered dialog on desktop) ─ */

export function Sheet({
  open,
  onClose,
  children,
  title,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[#1a1a17]/35 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div
        className={cx(
          "relative w-full bg-surface animate-sheet shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]",
          "rounded-t-[28px] sm:rounded-[28px] max-h-[92dvh] overflow-y-auto overscroll-contain",
          wide ? "sm:max-w-2xl" : "sm:max-w-[480px]",
          "sm:m-6",
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-surface/95 backdrop-blur px-6 pt-5 pb-3">
          <div className="sm:hidden absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-line" />
          <div className="text-[15px] font-semibold tracking-tight">{title}</div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-black/5 hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 pb-7">{children}</div>
      </div>
    </div>
  );
}

/* ── Status ──────────────────────────────────────────────── */

export const STATUS_META: Record<PurchaseStatus, { label: string; dot: string; text: string; bg: string }> = {
  decide: { label: "Decide", dot: "bg-ink", text: "text-ink", bg: "bg-[#f1f0ec]" },
  keep: { label: "Keeping", dot: "bg-faint", text: "text-muted", bg: "bg-[#f4f4f1]" },
  return: { label: "Return", dot: "bg-warn", text: "text-warn", bg: "bg-warn-bg" },
  return_started: { label: "Return started", dot: "bg-warn", text: "text-warn", bg: "bg-warn-bg" },
  ready_to_drop_off: { label: "Ready to drop off", dot: "bg-info", text: "text-info", bg: "bg-info-bg" },
  dropped_off: { label: "Dropped off", dot: "bg-violet", text: "text-violet", bg: "bg-violet-bg" },
  refunded: { label: "Refunded", dot: "bg-money", text: "text-money", bg: "bg-money-bg" },
};

export function StatusPill({ status }: { status: PurchaseStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium", m.bg, m.text)}>
      <span className={cx("h-1.5 w-1.5 rounded-full", m.dot)} />
      {m.label}
    </span>
  );
}

export function urgencyTone(days: number | null) {
  if (days === null) return "warn";
  if (days < 0) return "muted";
  if (days <= 4) return "urgent";
  if (days <= 7) return "warn";
  return "neutral";
}

export function DeadlineChip({ purchase, compact }: { purchase: Purchase; compact?: boolean }) {
  if (!purchase.returnDeadline) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-warn-bg px-2.5 py-1 text-[12px] font-medium text-warn">
        <span className="h-1.5 w-1.5 rounded-full bg-warn" />
        {compact ? "Deadline needs verification" : "Return deadline needs verification"}
      </span>
    );
  }
  const d = daysUntil(purchase.returnDeadline);
  const tone = urgencyTone(d);
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium tabular",
        tone === "urgent" && "bg-urgent-bg text-urgent",
        tone === "warn" && "bg-warn-bg text-warn",
        tone === "neutral" && "bg-[#f3f3f0] text-ink-2",
        tone === "muted" && "bg-[#f3f3f0] text-muted",
      )}
    >
      {d < 0 ? "Window closed" : relativeDays(d)}
    </span>
  );
}

export function deadlineText(p: Purchase) {
  return p.returnDeadline ? `Return by ${fmtDay(p.returnDeadline)}` : "Return by: needs verification";
}

/* ── Retailer + product visuals ─────────────────────────── */

export function RetailerLabel({
  purchase,
  className,
}: {
  purchase: Pick<Purchase, "retailer" | "retailerName" | "retailerDomain">;
  className?: string;
}) {
  return (
    <span className={cx("text-[11px] font-semibold uppercase tracking-[0.16em] text-muted", className)}>
      {retailerOf(purchase).name}
    </span>
  );
}

const GLYPHS: Record<Purchase["category"], ReactNode> = {
  shoes: (
    <path d="M6 31c0-3 1-9 3-11 2 1 5 2 7 1l3-4c3 4 8 7 14 8 5 1 9 3 9 6v2c0 1-1 2-2 2H8c-1 0-2-1-2-2v-2Zm0 2h36M18 23l2 2m2-4 2 2" />
  ),
  top: <path d="M17 9 9 13l-4 8 6 3 2-4v19h22V20l2 4 6-3-4-8-8-4c-1 3-4 5-7 5s-6-2-7-5Z" />,
  bottoms: <path d="M14 7h20l3 33h-8l-5-22-5 22h-8l3-33Zm0 5h20" />,
  dress: <path d="M19 7v6l-3 7 1 2-6 18h26l-6-18 1-2-3-7V7m-10 6h10m-11 9h12" />,
  outerwear: (
    <path d="M18 8 9 12 6 40h8l1-14v15h18V26l1 14h8l-3-28-9-4-6 6-6-6Zm6 6v27m-4-14h2m4 0h2" />
  ),
  beauty: <path d="M14 20h20v18a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3V20Zm2-7h16v7H16v-7Zm4 15h8" />,
  home: <path d="M8 16c0-3 3-5 6-5h20c3 0 6 2 6 5v16c0 3-3 5-6 5H14c-3 0-6-2-6-5V16Zm0 6h32M8 28h32m-26-17v26" />,
};

export function ProductTile({ purchase, size = 64, className }: { purchase: Purchase; size?: number; className?: string }) {
  if (purchase.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={purchase.imageUrl} alt="" width={size} height={size} className={cx("rounded-2xl object-cover", className)} />;
  }
  return (
    <div
      className={cx("grid shrink-0 place-items-center rounded-2xl ring-1 ring-black/[0.04]", className)}
      style={{ width: size, height: size, background: purchase.tint }}
      aria-hidden
    >
      <svg
        viewBox="0 0 48 48"
        width={size * 0.56}
        height={size * 0.56}
        fill="none"
        stroke="#2b2b28"
        strokeOpacity={0.72}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {GLYPHS[purchase.category]}
      </svg>
    </div>
  );
}

export function SimulatedTag({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border border-dashed border-[#cfcdc5] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted",
        className,
      )}
    >
      Simulated
    </span>
  );
}

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <div className="grid place-items-center rounded-[10px] bg-ink text-white" style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 24 24" width={size * 0.56} height={size * 0.56} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 14 4 9l5-5" />
        <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
      </svg>
    </div>
  );
}

export function SectionHeader({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-[22px] font-semibold tracking-tight sm:text-2xl">{title}</h2>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}
