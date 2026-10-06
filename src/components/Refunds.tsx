"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Clock, Search } from "lucide-react";
import { Button, ProductTile, RetailerLabel, SimulatedTag, TextLink, cx } from "./ui";
import { Empty } from "./DropOff";
import { useUI } from "./ui-context";
import { fmtDay, money } from "@/lib/dates";
import { useActions, useStore } from "@/lib/store";
import { refundRows, summary } from "@/lib/selectors";

export function RefundsView() {
  const { state, runSync } = useStore();
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  }, [state]);
  const { openSheet } = useUI();
  const { checkRefund, refundReceived } = useActions();
  const rows = refundRows(state);
  const s = summary(state);
  const [checking, setChecking] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  if (!rows.length)
    return <Empty title="No refunds to track yet" body="After you drop off a return, Return Agent watches your email for the refund." />;

  const runCheck = async (id: string) => {
    setChecking(id);
    if (state.mode === "live") {
      // Real check: pull new email from Gmail; a refund email flips this row to received.
      await runSync();
      await new Promise((r) => setTimeout(r, 50));
      const rf = latest.current.refunds.find((r) => r.id === id);
      if (rf?.status !== "received") checkRefund(id, false);
    } else {
      // MOCK: simulated email search in demo mode
      await new Promise((r) => setTimeout(r, 1300));
      checkRefund(id, true);
    }
    setChecking(null);
    setChecked((prev) => new Set(prev).add(id));
  };

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="rounded-2xl border border-line bg-surface px-4 py-3">
          <div className="text-[12px] text-muted">Waiting</div>
          <div className="tabular text-[22px] font-semibold tracking-tight">{money(s.refundsWaitingValue)}</div>
        </div>
        <div className="rounded-2xl border border-line bg-surface px-4 py-3">
          <div className="text-[12px] text-muted">Received</div>
          <div className="tabular text-[22px] font-semibold tracking-tight text-money">{money(s.refundedValue)}</div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {rows.map(({ refund, purchase, overdue, daysSinceDropOff }) => {
          const received = refund.status === "received";
          return (
            <div
              key={refund.id}
              className={cx("rounded-[24px] border bg-surface p-5", overdue ? "border-[#f1c9c3]" : "border-line")}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <ProductTile purchase={purchase} size={52} />
                  <div className="min-w-0">
                    <RetailerLabel purchase={purchase} />
                    <div className="truncate text-[16px] font-semibold tracking-tight">{purchase.itemName}</div>
                    <div className="text-[13px] text-muted">
                      {refund.droppedOffAt ? `Dropped off ${fmtDay(refund.droppedOffAt)}` : "Return in progress"}
                      {overdue && ` · ${daysSinceDropOff} days ago`}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-5 sm:justify-end">
                  <div className="sm:text-right">
                    <div className="text-[12px] text-muted">{received ? "Refund" : "Expected refund"}</div>
                    <div className={cx("tabular text-[20px] font-semibold tracking-tight", received && "text-money")}>
                      {money(refund.amount)}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 sm:min-w-[150px]">
                    {received ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-money-bg px-3 py-1.5 text-[12px] font-medium text-money">
                        <Check size={13} strokeWidth={2.5} />
                        Received {refund.receivedAt ? fmtDay(refund.receivedAt) : ""}
                      </span>
                    ) : overdue ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-urgent-bg px-3 py-1.5 text-[12px] font-medium text-urgent">
                        <AlertCircle size={13} />
                        Refund overdue
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-bg px-3 py-1.5 text-[12px] font-medium text-violet">
                        <Clock size={13} />
                        Waiting for refund
                      </span>
                    )}
                    {received && refund.emailSourceId && (
                      <TextLink onClick={() => openSheet({ kind: "email", id: purchase.id })}>View refund email</TextLink>
                    )}
                  </div>
                </div>
              </div>

              {!received && (
                <div className="mt-4 flex flex-col gap-3 border-t border-line-2 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-[13px] text-muted">
                    {checking === refund.id ? (
                      <span className="inline-flex items-center gap-2 text-ink-2">
                        <span className="h-4 w-4 rounded-full border-2 border-line border-t-ink animate-spin" />
                        Searching your email for a refund confirmation…
                      </span>
                    ) : checked.has(refund.id) ? (
                      <span className="inline-flex flex-wrap items-center gap-2">
                        No refund email found yet. Checked just now.
                        {state.mode !== "live" && <SimulatedTag />}
                      </span>
                    ) : overdue ? (
                      <>No refund detected {daysSinceDropOff} days after drop-off. Most refunds land well before this.</>
                    ) : (
                      <>Return Agent is watching your email for the refund.</>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => refundReceived(refund.id)}
                      disabled={checking === refund.id}
                    >
                      I got it
                    </Button>
                    <Button
                      size="sm"
                      variant={overdue ? "primary" : "secondary"}
                      onClick={() => runCheck(refund.id)}
                      disabled={checking === refund.id}
                    >
                      <Search size={14} />
                      Check refund
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
