"use client";

import { useState } from "react";
import { ArrowRight, Check, ChevronRight, Lock, Plus } from "lucide-react";
import { Button, DeadlineChip, ProductTile, RetailerLabel, SectionHeader, SimulatedTag, cx } from "./ui";
import { PurchaseCard } from "./PurchaseCard";
import { DropOffView, Empty } from "./DropOff";
import { RefundsView } from "./Refunds";
import { useUI, type InboxTab } from "./ui-context";
import { fmtDay, money, parseDay, relativeDays, daysUntil, todayISO } from "@/lib/dates";
import { retailerOf } from "@/lib/retailers";
import { useStore } from "@/lib/store";
import { attentionItems, byUrgency, dropOffGroups, summary } from "@/lib/selectors";
import type { Purchase, PurchaseStatus } from "@/lib/types";

/* ── Summary ─────────────────────────────────────────────── */

export function SummaryHero() {
  const { state } = useStore();
  const s = summary(state);
  return (
    <section className="flex flex-col justify-between rounded-[28px] border border-line bg-surface p-6 sm:p-8">
      <div>
        <div className="text-[14px] text-muted">Waiting to be returned</div>
        <div className="tabular mt-1 text-[64px] font-semibold leading-none tracking-[-0.045em] sm:text-[84px]">
          {money(s.pendingValue)}
        </div>
        <PipelineBar />
      </div>
      <div className="mt-8 grid grid-cols-3 gap-2 border-t border-line-2 pt-5 sm:gap-6">
        <Metric value={`${s.pendingCount}`} label={s.pendingCount === 1 ? "item" : "items"} />
        <Metric
          value={`${s.attentionCount}`}
          label={s.attentionCount === 1 ? "deadline this week" : "deadlines this week"}
          tone={s.attentionCount ? "warn" : undefined}
        />
        <Metric value={money(s.atRiskValue)} label="at risk" tone={s.atRiskValue ? "urgent" : undefined} />
      </div>
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted">
        <span>
          <span className="tabular font-medium text-ink-2">{money(s.refundsWaitingValue)}</span> in refunds on the way
        </span>
        <span>
          <span className="tabular font-medium text-money">{money(s.refundedValue)}</span> refunded
        </span>
        {s.decideCount > 0 && (
          <span>
            <span className="font-medium text-ink-2">{s.decideCount}</span> waiting on your decision
          </span>
        )}
      </div>
    </section>
  );
}

function PipelineBar() {
  const { state } = useStore();
  const segs = [
    { label: "Not started", statuses: ["return", "return_started"], color: "bg-warn" },
    { label: "Ready to drop off", statuses: ["ready_to_drop_off"], color: "bg-info" },
  ].map((g) => {
    const items = state.purchases.filter((p) => g.statuses.includes(p.status));
    return { ...g, count: items.length, value: items.reduce((a, p) => a + (p.price ?? 0), 0) };
  });
  const total = segs.reduce((a, x) => a + x.value, 0);
  if (!total) return null;
  return (
    <div className="mt-7">
      <div className="flex h-2 w-full gap-1 overflow-hidden rounded-full">
        {segs.map((x) =>
          x.value ? <div key={x.label} className={cx("h-full rounded-full", x.color)} style={{ width: `${(x.value / total) * 100}%` }} /> : null,
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
        {segs.map((x) => (
          <span key={x.label} className="inline-flex items-center gap-2 text-muted">
            <span className={cx("h-2 w-2 rounded-full", x.color)} />
            {x.label}
            <span className="tabular font-medium text-ink">
              {x.count} · {money(x.value)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Metric({ value, label, tone }: { value: string; label: string; tone?: "warn" | "urgent" }) {
  return (
    <div>
      <div
        className={cx(
          "tabular text-[22px] font-semibold tracking-tight sm:text-[26px]",
          tone === "warn" && "text-warn",
          tone === "urgent" && "text-urgent",
        )}
      >
        {value}
      </div>
      <div className="text-[12px] leading-tight text-muted sm:text-[13px]">{label}</div>
    </div>
  );
}

/* ── Agent insight (the hero) ───────────────────────────── */

export function AgentInsight() {
  const { state } = useStore();
  const { goToTab, openSheet } = useUI();
  const s = summary(state);
  const groups = dropOffGroups(state);
  const attention = attentionItems(state);
  const best = groups[0];
  const rideAlong = best
    ? attention.find(
        (p) => (p.status === "decide" || p.status === "return") && retailerOf(p).methods.includes(best.methodId),
      )
    : undefined;
  const overdue = s.overdueRefunds[0];

  let body: React.ReactNode;
  let cta: { label: string; onClick: () => void } | null = null;

  if (best) {
    body = (
      <>
        <p className="text-[15px] text-white/70">Your best next action is one {best.label} trip:</p>
        <div className="tabular mt-2 text-[34px] font-semibold leading-tight tracking-[-0.03em] sm:text-[40px]">
          {best.items.length} {best.items.length === 1 ? "item" : "items"} · {money(best.total)}
          <span className="text-white/50"> refund</span>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <div className="flex -space-x-2">
            {best.items.slice(0, 4).map(({ purchase }) => (
              <ProductTile key={purchase.id} purchase={purchase} size={36} className="rounded-xl ring-2 ring-[#161614]" />
            ))}
          </div>
          <span className="truncate text-[13px] text-white/60">
            {best.items.map((i) => i.purchase.itemName).join(", ")}
          </span>
        </div>
        {rideAlong && (
          <p className="mt-5 rounded-2xl bg-white/[0.07] px-4 py-3 text-[13px] leading-relaxed text-white/80">
            {rideAlong.status === "decide" ? "Decide on" : "Start the return for"}{" "}
            <span className="font-medium text-white">{rideAlong.itemName}</span> today (
            {relativeDays(daysUntil(rideAlong.returnDeadline!)).toLowerCase()}) and it can go on the same trip.
          </p>
        )}
      </>
    );
    cta = { label: "Show me what to take", onClick: () => goToTab("dropoff") };
  } else if (attention[0]) {
    const p = attention[0];
    body = (
      <>
        <p className="text-[15px] text-white/70">Your best next action:</p>
        <div className="mt-2 text-[30px] font-semibold leading-tight tracking-[-0.03em]">
          Decide on {p.itemName} by {fmtDay(p.returnDeadline)}
        </div>
      </>
    );
    cta = { label: "Review returns", onClick: () => openSheet({ kind: "review" }) };
  } else if (overdue) {
    const p = state.purchases.find((x) => x.id === overdue.purchaseId);
    body = (
      <>
        <p className="text-[15px] text-white/70">Your best next action:</p>
        <div className="mt-2 text-[30px] font-semibold leading-tight tracking-[-0.03em]">
          Follow up on your {p?.itemName} refund
        </div>
      </>
    );
    cta = { label: "Check refund", onClick: () => goToTab("refunds") };
  } else {
    body = (
      <div className="text-[28px] font-semibold leading-tight tracking-[-0.03em]">
        Nothing needs you today. I’ll keep watching your inbox.
      </div>
    );
  }

  return (
    <section className="relative flex flex-col overflow-hidden rounded-[28px] bg-[#161614] p-6 text-white sm:p-8">
      <div className="mb-6 flex items-center gap-2 text-[13px] text-white/60">
        <span className="relative flex h-2 w-2">
          <span className="absolute inset-0 rounded-full bg-[#5fd39a] animate-ping-soft" />
          <span className="relative h-2 w-2 rounded-full bg-[#5fd39a]" />
        </span>
        Return Agent
      </div>
      {s.pendingCount > 0 && (
        <p className="text-[16px] leading-relaxed text-white/85">
          You have <span className="tabular font-semibold text-white">{money(s.pendingValue)}</span> worth of items marked
          for return.
          {s.atRiskValue > 0 && (
            <>
              {" "}
              <span className="tabular font-semibold text-[#ffb4a8]">{money(s.atRiskValue)}</span> of returns expire in the
              next 7 days.
            </>
          )}
        </p>
      )}
      <div className="mt-6 flex-1">{body}</div>
      {cta && (
        <Button variant="inverse" size="lg" className="mt-7 w-full sm:w-auto sm:self-start" onClick={cta.onClick}>
          {cta.label}
          <ArrowRight size={17} />
        </Button>
      )}
    </section>
  );
}

/* ── Attention alert ─────────────────────────────────────── */

export function AttentionAlert() {
  const { state } = useStore();
  const { openSheet } = useUI();
  const items = attentionItems(state);
  if (!items.length) return null;
  return (
    <section className="rounded-[28px] border border-[#f3d6d1] bg-surface p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-urgent-bg text-[15px] font-semibold text-urgent">
            {items.length}
          </span>
          <h2 className="text-[17px] font-semibold tracking-tight sm:text-[19px]">
            {items.length === 1 ? "return needs" : "returns need"} your attention
          </h2>
        </div>
        <Button size="sm" className="hidden sm:inline-flex" onClick={() => openSheet({ kind: "review" })}>
          Review returns
        </Button>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {items.map((p) => (
          <button
            key={p.id}
            onClick={() => openSheet({ kind: "review" })}
            className="flex items-center gap-3 rounded-2xl bg-canvas/70 p-3 text-left transition hover:bg-canvas"
          >
            <ProductTile purchase={p} size={48} className="rounded-xl" />
            <div className="min-w-0 flex-1">
              <RetailerLabel purchase={p} className="text-[10px]" />
              <div className="truncate text-[15px] font-medium">{p.itemName}</div>
              <div className="text-[12px] text-muted">Return by {fmtDay(p.returnDeadline)}</div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="tabular text-[15px] font-semibold">{money(p.price)}</span>
              <DeadlineChip purchase={p} />
            </div>
          </button>
        ))}
      </div>
      <Button className="mt-4 w-full sm:hidden" onClick={() => openSheet({ kind: "review" })}>
        Review returns
      </Button>
    </section>
  );
}

/* ── Returns inbox ──────────────────────────────────────── */

const TAB_STATUSES: Record<Exclude<InboxTab, "all">, PurchaseStatus[]> = {
  decide: ["decide"],
  return: ["return", "return_started"],
  dropoff: ["ready_to_drop_off"],
  refunds: ["dropped_off", "refunded"],
};

const STATUS_ORDER: PurchaseStatus[] = ["decide", "return", "return_started", "ready_to_drop_off", "dropped_off", "refunded", "keep"];
const ACTIVE: PurchaseStatus[] = ["decide", "return", "return_started", "ready_to_drop_off"];

function sortAll(a: Purchase, b: Purchase) {
  const aa = ACTIVE.includes(a.status);
  const ba = ACTIVE.includes(b.status);
  if (aa && ba) return byUrgency(a, b);
  if (aa !== ba) return aa ? -1 : 1;
  return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
}

export function ReturnsInbox() {
  const { state } = useStore();
  const { tab, goToTab, openSheet } = useUI();
  const attentionIds = new Set(attentionItems(state).map((p) => p.id));
  const count = (t: InboxTab) =>
    t === "all" ? state.purchases.length : state.purchases.filter((p) => TAB_STATUSES[t].includes(p.status)).length;

  const tabs: { id: InboxTab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "decide", label: "Decide" },
    { id: "return", label: "Return" },
    { id: "dropoff", label: "Drop off" },
    { id: "refunds", label: "Refunds" },
  ];

  const list =
    tab === "all"
      ? [...state.purchases].sort(sortAll)
      : state.purchases.filter((p) => TAB_STATUSES[tab as Exclude<InboxTab, "all">].includes(p.status)).sort(byUrgency);

  return (
    <section id="inbox" className="scroll-mt-6">
      <SectionHeader
        title="Returns Inbox"
        sub={`Return Agent organized ${state.purchases.length} purchases from your email.`}
        right={
          <Button variant="secondary" size="sm" onClick={() => openSheet({ kind: "add" })} className="hidden sm:inline-flex">
            <Plus size={15} />
            Add purchase
          </Button>
        }
      />
      <div className="no-scrollbar -mx-5 mb-6 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <div className="inline-flex gap-1 rounded-full border border-line bg-surface p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => goToTab(t.id, false)}
              className={cx(
                "flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-medium transition whitespace-nowrap",
                tab === t.id ? "bg-ink text-white" : "text-ink-2 hover:bg-canvas",
              )}
            >
              {t.label.toUpperCase()}
              <span className={cx("tabular text-[11px]", tab === t.id ? "text-white/60" : "text-faint")}>{count(t.id)}</span>
            </button>
          ))}
        </div>
      </div>

      <div key={tab} className="animate-fade-up">
        {tab === "dropoff" ? (
          <DropOffView />
        ) : tab === "refunds" ? (
          <RefundsView />
        ) : list.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((p) => (
              <PurchaseCard key={p.id} purchase={p} highlight={attentionIds.has(p.id)} />
            ))}
          </div>
        ) : (
          <Empty
            title={tab === "decide" ? "Nothing to decide" : "No returns in progress"}
            body={tab === "decide" ? "New purchases Return Agent finds will show up here." : "Mark something for return and it lands here."}
          />
        )}
      </div>
    </section>
  );
}

/* ── Agent activity ─────────────────────────────────────── */

export function AgentActivityFeed() {
  const { state } = useStore();
  const [all, setAll] = useState(false);
  const acts = [...state.activities].sort((a, b) => b.at.localeCompare(a.at));
  const shown = all ? acts : acts.slice(0, 10);

  const counts = {
    emails: state.emails.length,
    purchases: state.purchases.filter((p) => p.origin === "email").length,
    codes: state.returns.length,
    refunds: state.refunds.filter((r) => r.status === "received").length,
  };

  const dayLabel = (iso: string) => {
    const day = iso.slice(0, 10);
    const local = new Date(iso);
    const key = isNaN(local.getTime()) ? day : `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
    if (key === todayISO()) return "Today";
    return parseDay(key).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const labels = shown.map((a) => dayLabel(a.at));
  return (
    <section id="activity" className="scroll-mt-6">
      <SectionHeader title="What Return Agent handled" sub="Everything the agent did for you, with sources." />
      <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr]">
        <div className="grid grid-cols-2 gap-3 self-start">
          <Count n={counts.emails} label="shopping emails read" />
          <Count n={counts.purchases} label="purchases found" />
          <Count n={counts.codes} label="return codes organized" />
          <Count n={counts.refunds} label="refunds detected" />
        </div>
        <div className="rounded-[28px] border border-line bg-surface p-5 sm:p-6">
          <ul className="flex flex-col">
            {shown.map((a, i) => {
              const label = labels[i];
              const header = i === 0 || label !== labels[i - 1];
              const p = a.purchaseId ? state.purchases.find((x) => x.id === a.purchaseId) : null;
              return (
                <li key={a.id}>
                  {header && (
                    <div className="pb-2 pt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint first:pt-0">
                      {label}
                    </div>
                  )}
                  <div className="flex items-start gap-3 py-2">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-money-bg text-money">
                      <Check size={11} strokeWidth={3} />
                    </span>
                    <span className="flex-1 text-[14px] leading-snug">{a.message}</span>
                    {a.simulated ? (
                      <SimulatedTag />
                    ) : p ? (
                      <span className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-faint sm:inline">
                        {retailerOf(p).name}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          {acts.length > 10 && (
            <button
              onClick={() => setAll(!all)}
              className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-ink-2 hover:text-ink"
            >
              {all ? "Show less" : `Show all ${acts.length}`}
              <ChevronRight size={14} className={cx("transition", all && "-rotate-90")} />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function Count({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-[22px] border border-line bg-surface p-4">
      <div className="tabular text-[28px] font-semibold tracking-tight">{n}</div>
      <div className="text-[12px] leading-snug text-muted">{label}</div>
    </div>
  );
}

export function TrustNote() {
  const { openSheet } = useUI();
  return (
    <button
      onClick={() => openSheet({ kind: "privacy" })}
      className="flex w-full items-start gap-3 rounded-[22px] border border-line bg-surface p-5 text-left transition hover:bg-[#fbfbf9]"
    >
      <Lock size={18} className="mt-0.5 shrink-0 text-money" />
      <span className="text-[13px] leading-relaxed text-ink-2">
        Return Agent searches only for shopping-related emails needed to manage purchases and returns. Every purchase
        links to its source email. <span className="font-medium text-ink underline underline-offset-4">See exactly what it reads</span>
      </span>
    </button>
  );
}
