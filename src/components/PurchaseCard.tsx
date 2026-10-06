"use client";

import { Check, QrCode, RotateCcw } from "lucide-react";
import { Button, DeadlineChip, ProductTile, RetailerLabel, StatusPill, TextLink, cx } from "./ui";
import { useUI } from "./ui-context";
import { fmtDay, money } from "@/lib/dates";
import { RETURN_METHODS } from "@/lib/retailers";
import { useActions, useStore } from "@/lib/store";
import { returnFor } from "@/lib/selectors";
import type { Purchase } from "@/lib/types";

const ACTIVE = ["decide", "return", "return_started", "ready_to_drop_off"];

export function PurchaseCard({ purchase: p, highlight }: { purchase: Purchase; highlight?: boolean }) {
  const { state } = useStore();
  const { openSheet } = useUI();
  const { keep, markReturn, undecide } = useActions();
  const ret = returnFor(state, p.id);
  const refund = state.refunds.find((r) => r.purchaseId === p.id);
  const active = ACTIVE.includes(p.status);

  const startReturn = () => {
    if (p.status === "decide") markReturn(p.id);
    openSheet({ kind: "return", id: p.id });
  };

  return (
    <article
      className={cx(
        "group flex flex-col rounded-[24px] border bg-surface p-5 transition hover:shadow-[0_12px_32px_-16px_rgba(0,0,0,0.12)]",
        highlight ? "border-[#f1c9c3] ring-4 ring-urgent-bg" : "border-line",
        !active && "bg-surface/70",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <RetailerLabel purchase={p} />
          {p.inboxLabel && (
            <span className="truncate rounded-full bg-canvas px-2 py-0.5 text-[10px] font-medium text-muted" title="Found in a second connected inbox">
              {p.inboxLabel}
            </span>
          )}
        </span>
        <StatusPill status={p.status} />
      </div>

      <div className="mt-4 flex items-start gap-4">
        <ProductTile purchase={p} size={68} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] font-semibold leading-snug tracking-tight">{p.itemName}</h3>
          {p.variant && <p className="mt-0.5 truncate text-[13px] text-muted">{p.variant}</p>}
          <p className="tabular mt-1.5 text-[20px] font-semibold tracking-tight">
            {p.price === null ? <span className="text-[14px] font-medium text-warn">Price needs verification</span> : money(p.price)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-muted">
        <span>Ordered {p.orderDate ? fmtDay(p.orderDate) : "date unknown"}</span>
        {active && p.returnDeadline && (
          <>
            <span className="h-1 w-1 rounded-full bg-line" />
            <span className="text-ink-2">Return by {fmtDay(p.returnDeadline)}</span>
          </>
        )}
      </div>
      {active && (
        <div className="mt-2.5">
          {p.returnDeadline ? (
            <DeadlineChip purchase={p} />
          ) : (
            <button onClick={() => openSheet({ kind: "order", id: p.id })} title="Set the return deadline" className="transition hover:opacity-80">
              <DeadlineChip purchase={p} />
            </button>
          )}
        </div>
      )}

      <div className="mt-auto pt-5">
        {p.status === "decide" && (
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={startReturn}>Return</Button>
            <Button variant="secondary" onClick={() => keep(p.id)}>
              Keep
            </Button>
          </div>
        )}
        {(p.status === "return" || p.status === "return_started") && (
          <div className="flex items-center gap-2">
            <Button className="flex-1" onClick={startReturn}>
              Start return
            </Button>
            <Button variant="ghost" size="md" onClick={() => undecide(p.id)} title="Undo">
              <RotateCcw size={15} />
            </Button>
          </div>
        )}
        {p.status === "ready_to_drop_off" && ret && (
          <div className="flex flex-col gap-2">
            <div className="text-[13px] text-ink-2">
              Take to <span className="font-medium text-ink">{RETURN_METHODS[ret.methodId].label}</span>
            </div>
            <Button variant="secondary" onClick={() => openSheet({ kind: "codes", methodId: ret.methodId })}>
              <QrCode size={16} />
              {ret.artifact?.type === "label" ? "Show label" : "Show return code"}
            </Button>
          </div>
        )}
        {p.status === "dropped_off" && refund && (
          <div className="rounded-2xl bg-violet-bg px-4 py-3 text-[13px] text-violet">
            {refund.droppedOffAt ? `Dropped off ${fmtDay(refund.droppedOffAt)} · ` : ""}waiting for {money(refund.amount)} refund
          </div>
        )}
        {p.status === "refunded" && refund && (
          <div className="flex items-center gap-2 rounded-2xl bg-money-bg px-4 py-3 text-[13px] text-money">
            <Check size={15} strokeWidth={2.5} />
            {money(refund.amount)} refunded {refund.receivedAt ? fmtDay(refund.receivedAt) : ""}
          </div>
        )}
        {p.status === "keep" && (
          <div className="flex items-center justify-between rounded-2xl bg-canvas px-4 py-3 text-[13px] text-muted">
            Keeping this one
            <TextLink onClick={() => undecide(p.id)}>Undo</TextLink>
          </div>
        )}

        <div className="mt-4 flex items-center gap-4 border-t border-line-2 pt-3.5">
          <TextLink onClick={() => openSheet({ kind: "order", id: p.id })}>View order</TextLink>
          {p.emailSourceId ? (
            <TextLink onClick={() => openSheet({ kind: "email", id: p.id })}>View source email</TextLink>
          ) : (
            <span className="text-[13px] text-faint">Added manually</span>
          )}
        </div>
      </div>
    </article>
  );
}
