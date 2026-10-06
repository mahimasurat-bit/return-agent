/**
 * Pure state transitions shared by the browser (optimistic UI, demo mode) and
 * the server (/api/actions persists the same transitions for live mode).
 */
import { fmtDay, nowISO, todayISO } from "./dates";
import { RETURN_METHODS, retailerOf } from "./retailers";
import type {
  AgentActivity,
  EmailSource,
  Purchase,
  Refund,
  Return,
  ReturnArtifact,
  ReturnMethodId,
  ReturnReason,
} from "./types";

export interface DataState {
  purchases: Purchase[];
  emails: EmailSource[];
  returns: Return[];
  refunds: Refund[];
  activities: AgentActivity[];
}

export const EMPTY_DATA: DataState = { purchases: [], emails: [], returns: [], refunds: [], activities: [] };

export type DataAction =
  | { type: "keep"; id: string }
  | { type: "undecide"; id: string }
  | { type: "markReturn"; id: string }
  | {
      type: "completeReturn";
      id: string;
      reason: ReturnReason;
      note: string | null;
      methodId: ReturnMethodId;
      artifact: ReturnArtifact;
    }
  | { type: "droppedOff"; ids: string[] }
  /** `found: false` records that a check ran and found nothing. `simulated` marks demo checks. */
  | { type: "checkRefund"; id: string; simulated: boolean }
  | { type: "refundReceived"; id: string }
  | { type: "addPurchase"; purchase: Purchase }
  /** The user confirms a return deadline (e.g. from the retailer's site). */
  | { type: "setDeadline"; id: string; date: string };

export const DATA_ACTION_TYPES = new Set<DataAction["type"]>([
  "keep",
  "undecide",
  "markReturn",
  "completeReturn",
  "droppedOff",
  "checkRefund",
  "refundReceived",
  "addPurchase",
  "setDeadline",
]);

let seq = 0;
export const uid = (p: string) =>
  `${p}_${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function makeActivity(a: Omit<AgentActivity, "id" | "at"> & { at?: string }): AgentActivity {
  return { id: uid("act"), at: a.at ?? nowISO(), ...a };
}

function setStatus(s: DataState, ids: string[], status: Purchase["status"]): Purchase[] {
  return s.purchases.map((p) => (ids.includes(p.id) ? { ...p, status } : p));
}

export function applyDataAction<S extends DataState>(s: S, a: DataAction): S {
  const find = (id: string) => s.purchases.find((p) => p.id === id);
  switch (a.type) {
    case "keep": {
      const p = find(a.id);
      if (!p) return s;
      return {
        ...s,
        purchases: setStatus(s, [a.id], "keep"),
        activities: [
          makeActivity({ purchaseId: a.id, type: "kept", message: `You kept ${p.itemName}. Stopped tracking its deadline`, simulated: false }),
          ...s.activities,
        ],
      };
    }
    case "undecide":
      return { ...s, purchases: setStatus(s, [a.id], "decide") };
    case "markReturn": {
      const p = find(a.id);
      if (!p) return s;
      return {
        ...s,
        purchases: setStatus(s, [a.id], "return"),
        activities: [
          makeActivity({ purchaseId: a.id, type: "return_marked", message: `Marked ${p.itemName} for return`, simulated: false }),
          ...s.activities,
        ],
      };
    }
    case "completeReturn": {
      const p = find(a.id);
      if (!p) return s;
      const ret: Return = {
        id: uid("r"),
        purchaseId: a.id,
        reason: a.reason,
        reasonNote: a.note,
        methodId: a.methodId,
        refundAmount: p.price,
        createdAt: nowISO(),
        droppedOffAt: null,
        artifact: a.artifact,
        simulated: true,
      };
      const name = retailerOf(p).name;
      return {
        ...s,
        purchases: setStatus(s, [a.id], "ready_to_drop_off"),
        returns: [...s.returns.filter((r) => r.purchaseId !== a.id), ret],
        activities: [
          makeActivity({ purchaseId: a.id, type: "return_code_generated", message: `Return code generated for ${RETURN_METHODS[a.methodId].label}`, simulated: true }),
          makeActivity({ purchaseId: a.id, type: "return_started", message: `Started ${name} return · ${a.reason}`, simulated: true }),
          ...s.activities,
        ],
      };
    }
    case "droppedOff": {
      const day = todayISO();
      const newRefunds: Refund[] = [];
      const acts: AgentActivity[] = [];
      const returns = s.returns.map((r) => {
        if (!a.ids.includes(r.purchaseId) || r.droppedOffAt) return r;
        if (!s.refunds.some((x) => x.purchaseId === r.purchaseId)) {
          newRefunds.push({
            id: uid("rf"),
            purchaseId: r.purchaseId,
            returnId: r.id,
            amount: r.refundAmount,
            status: "waiting",
            droppedOffAt: day,
            receivedAt: null,
            emailSourceId: null,
            lastCheckedAt: null,
          });
        }
        const p = find(r.purchaseId);
        acts.push(
          makeActivity({
            purchaseId: r.purchaseId,
            type: "dropped_off",
            message: `${p?.itemName ?? "Package"} dropped off${r.methodId === "other" ? "" : ` at ${RETURN_METHODS[r.methodId].label}`}. Watching for refund`,
            simulated: false,
          }),
        );
        return { ...r, droppedOffAt: day };
      });
      return {
        ...s,
        purchases: setStatus(s, a.ids, "dropped_off"),
        returns,
        refunds: [...s.refunds.map((x) => (a.ids.includes(x.purchaseId) && !x.droppedOffAt ? { ...x, droppedOffAt: day } : x)), ...newRefunds],
        activities: [...acts, ...s.activities],
      };
    }
    case "checkRefund": {
      const rf = s.refunds.find((r) => r.id === a.id);
      const p = rf && find(rf.purchaseId);
      if (!rf || !p) return s;
      return {
        ...s,
        refunds: s.refunds.map((r) => (r.id === a.id ? { ...r, lastCheckedAt: nowISO() } : r)),
        activities: [
          makeActivity({
            purchaseId: p.id,
            type: "refund_checked",
            message: `Checked for a ${retailerOf(p).name} refund email. None found yet`,
            simulated: a.simulated,
          }),
          ...s.activities,
        ],
      };
    }
    case "refundReceived": {
      const rf = s.refunds.find((r) => r.id === a.id);
      const p = rf && find(rf.purchaseId);
      if (!rf || !p) return s;
      return {
        ...s,
        purchases: setStatus(s, [p.id], "refunded"),
        refunds: s.refunds.map((r) => (r.id === a.id ? { ...r, status: "received", receivedAt: todayISO() } : r)),
        activities: [
          makeActivity({ purchaseId: p.id, type: "refund_detected", message: `Refund confirmed by you: ${p.itemName}`, simulated: false }),
          ...s.activities,
        ],
      };
    }
    case "setDeadline": {
      const p = find(a.id);
      if (!p || !/^\d{4}-\d{2}-\d{2}$/.test(a.date)) return s;
      return {
        ...s,
        purchases: s.purchases.map((x) =>
          x.id === a.id
            ? {
                ...x,
                returnDeadline: a.date,
                deadlineSource: { kind: "verified", note: "Entered by you" },
                unverifiedFields: x.unverifiedFields.filter((f) => f !== "returnDeadline"),
              }
            : x,
        ),
        activities: [
          makeActivity({ purchaseId: p.id, type: "deadline_found", message: `You set the return deadline for ${p.itemName}: ${fmtDay(a.date)}`, simulated: false }),
          ...s.activities,
        ],
      };
    }
    case "addPurchase":
      return {
        ...s,
        purchases: [a.purchase, ...s.purchases],
        activities: [
          makeActivity({ purchaseId: a.purchase.id, type: "manual_added", message: `You added ${a.purchase.itemName} manually`, simulated: false }),
          ...s.activities,
        ],
      };
  }
}
