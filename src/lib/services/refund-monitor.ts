/**
 * Refund monitoring.
 *
 * V1: refunds come from fixture refund emails; "Check refund" is simulated.
 * Future: a daily job searches GMAIL_QUERIES.refund_confirmation, matches by
 * order number, and marks the Refund received automatically.
 */
import { daysSince } from "../dates";
import type { Refund } from "../types";

/** Alert heuristic, not a retailer promise: flag when no refund is seen after this many days. */
export const REFUND_OVERDUE_AFTER_DAYS = 10;

export function isRefundOverdue(r: Refund): boolean {
  return r.status === "waiting" && !!r.droppedOffAt && daysSince(r.droppedOffAt) > REFUND_OVERDUE_AFTER_DAYS;
}
