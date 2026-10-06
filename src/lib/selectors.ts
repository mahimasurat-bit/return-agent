import { daysUntil, daysSince } from "./dates";
import { RETURN_METHODS } from "./retailers";
import { isRefundOverdue } from "./services/refund-monitor";
import type { AppState } from "./store";
import type { Purchase, PurchaseStatus, Refund, Return, ReturnMethodId } from "./types";

export const PENDING_RETURN: PurchaseStatus[] = ["return", "return_started", "ready_to_drop_off"];
export const NOT_YET_DROPPED: PurchaseStatus[] = ["decide", ...PENDING_RETURN];

export const ATTENTION_WINDOW_DAYS = 7;

const sum = (xs: (number | null)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);

export function deadlineDays(p: Purchase): number | null {
  return p.returnDeadline ? daysUntil(p.returnDeadline) : null;
}

export function byUrgency(a: Purchase, b: Purchase) {
  const da = deadlineDays(a) ?? 999;
  const db = deadlineDays(b) ?? 999;
  return da - db;
}

/** Items whose verified deadline is within the window and haven't been dropped off. */
export function attentionItems(s: AppState): Purchase[] {
  return s.purchases
    .filter((p) => NOT_YET_DROPPED.includes(p.status))
    .filter((p) => {
      const d = deadlineDays(p);
      return d !== null && d >= 0 && d <= ATTENTION_WINDOW_DAYS;
    })
    .sort(byUrgency);
}

export function summary(s: AppState) {
  const pending = s.purchases.filter((p) => PENDING_RETURN.includes(p.status));
  const attention = attentionItems(s);
  const needsVerification = s.purchases.filter(
    (p) => NOT_YET_DROPPED.includes(p.status) && p.deadlineSource.kind === "needs_verification",
  );
  const waitingRefunds = s.refunds.filter((r) => r.status === "waiting");
  return {
    pendingValue: sum(pending.map((p) => p.price)),
    pendingCount: pending.length,
    attentionCount: attention.length,
    atRiskValue: sum(attention.map((p) => p.price)),
    decideCount: s.purchases.filter((p) => p.status === "decide").length,
    needsVerificationCount: needsVerification.length,
    refundsWaitingValue: sum(waitingRefunds.map((r) => r.amount)),
    refundsWaitingCount: waitingRefunds.length,
    refundedValue: sum(s.refunds.filter((r) => r.status === "received").map((r) => r.amount)),
    overdueRefunds: waitingRefunds.filter(isRefundOverdue),
  };
}

export interface DropOffGroup {
  methodId: ReturnMethodId;
  label: string;
  items: { purchase: Purchase; ret: Return }[];
  total: number;
  earliestDeadline: string | null;
}

export function dropOffGroups(s: AppState): DropOffGroup[] {
  const groups = new Map<ReturnMethodId, DropOffGroup>();
  for (const p of s.purchases.filter((x) => x.status === "ready_to_drop_off")) {
    const ret = s.returns.find((r) => r.purchaseId === p.id && !r.droppedOffAt);
    if (!ret) continue;
    const g =
      groups.get(ret.methodId) ??
      { methodId: ret.methodId, label: RETURN_METHODS[ret.methodId].label, items: [], total: 0, earliestDeadline: null };
    g.items.push({ purchase: p, ret });
    g.total += ret.refundAmount ?? p.price ?? 0;
    if (p.returnDeadline && (!g.earliestDeadline || p.returnDeadline < g.earliestDeadline))
      g.earliestDeadline = p.returnDeadline;
    groups.set(ret.methodId, g);
  }
  return [...groups.values()].sort((a, b) => b.items.length - a.items.length || b.total - a.total);
}

export interface RefundRow {
  refund: Refund;
  purchase: Purchase;
  overdue: boolean;
  daysSinceDropOff: number;
}

export function refundRows(s: AppState): RefundRow[] {
  return s.refunds
    .map((refund) => {
      const purchase = s.purchases.find((p) => p.id === refund.purchaseId)!;
      return { refund, purchase, overdue: isRefundOverdue(refund), daysSinceDropOff: refund.droppedOffAt ? daysSince(refund.droppedOffAt) : 0 };
    })
    .filter((r) => r.purchase)
    .sort((a, b) => {
      const rank = (r: RefundRow) => (r.overdue ? 0 : r.refund.status === "waiting" ? 1 : 2);
      return rank(a) - rank(b) || (b.refund.droppedOffAt ?? "").localeCompare(a.refund.droppedOffAt ?? "");
    });
}

export function returnFor(s: AppState, purchaseId: string): Return | undefined {
  return s.returns.find((r) => r.purchaseId === purchaseId);
}
