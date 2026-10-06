"use client";

import { useState } from "react";
import { Check, MapPin, QrCode, Ticket } from "lucide-react";
import { Button, ProductTile, RetailerLabel, SimulatedTag, cx } from "./ui";
import { ReturnArtifactView } from "./ReturnCode";
import { useUI } from "./ui-context";
import { fmtDay, money, daysUntil } from "@/lib/dates";
import { RETURN_METHODS } from "@/lib/retailers";
import { useActions, useStore } from "@/lib/store";
import { dropOffGroups } from "@/lib/selectors";
import type { ReturnMethodId } from "@/lib/types";

export function DropOffView() {
  const { state } = useStore();
  const { openSheet } = useUI();
  const { droppedOff } = useActions();
  const groups = dropOffGroups(state);
  const [confirming, setConfirming] = useState<ReturnMethodId | null>(null);

  if (!groups.length)
    return (
      <Empty
        title="Nothing to drop off"
        body="When you start a return, Return Agent groups it here by where you need to take it."
      />
    );

  const totalItems = groups.reduce((a, g) => a + g.items.length, 0);

  return (
    <div>
      <p className="mb-5 text-[15px] text-ink-2">
        {totalItems === 1
          ? "One trip covers your return."
          : `${groups.length === 1 ? "One trip covers" : `${groups.length} trips cover`} ${totalItems === 2 ? "both" : `all ${totalItems}`} returns.`}
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((g, gi) => {
          const isLabel = RETURN_METHODS[g.methodId].artifact === "label";
          const d = g.earliestDeadline ? daysUntil(g.earliestDeadline) : null;
          return (
            <section
              key={g.methodId}
              className={cx("rounded-[24px] border bg-surface p-6", gi === 0 ? "border-ink/80" : "border-line")}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">
                    <MapPin size={13} />
                    {g.label}
                    {gi === 0 && groups.length > 1 && (
                      <span className="ml-1 rounded-full bg-ink px-2 py-0.5 text-[10px] tracking-wider text-white">Best trip</span>
                    )}
                  </div>
                  <div className="mt-2 text-[28px] font-semibold tracking-tight">
                    {g.items.length} {g.items.length === 1 ? "item" : "items"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="tabular text-[28px] font-semibold tracking-tight text-money">{money(g.total)}</div>
                  <div className="text-[12px] text-muted">total refund</div>
                </div>
              </div>

              <ul className="mt-5 flex flex-col divide-y divide-line-2 border-y border-line-2">
                {g.items.map(({ purchase }) => (
                  <li key={purchase.id} className="flex items-center gap-3 py-3">
                    <ProductTile purchase={purchase} size={40} className="rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <RetailerLabel purchase={purchase} className="text-[10px]" />
                      <div className="truncate text-[14px] font-medium">{purchase.itemName}</div>
                    </div>
                    <div className="text-right text-[12px] text-muted">
                      {purchase.returnDeadline ? `by ${fmtDay(purchase.returnDeadline)}` : "deadline unverified"}
                    </div>
                  </li>
                ))}
              </ul>

              {d !== null && (
                <p className={cx("mt-3 text-[13px]", d <= 4 ? "text-urgent" : "text-muted")}>
                  Go by {fmtDay(g.earliestDeadline)} to make every deadline.
                </p>
              )}

              {confirming === g.methodId ? (
                <div className="mt-4 rounded-2xl bg-canvas p-4">
                  <p className="text-[14px] font-medium">
                    Dropped off all {g.items.length} at {g.label}?
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setConfirming(null)}>
                      Not yet
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        droppedOff(g.items.map((i) => i.purchase.id));
                        setConfirming(null);
                      }}
                    >
                      Yes, all dropped off
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button onClick={() => openSheet({ kind: "codes", methodId: g.methodId })}>
                    {isLabel ? <Ticket size={16} /> : <QrCode size={16} />}
                    {isLabel ? "Show labels" : "Show return codes"}
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirming(g.methodId)}>
                    <Check size={16} />
                    Dropped off
                  </Button>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function CodesSheetBody({ methodId }: { methodId: ReturnMethodId }) {
  const { state } = useStore();
  const g = dropOffGroups(state).find((x) => x.methodId === methodId);
  if (!g) return <p className="text-muted">No returns waiting for {RETURN_METHODS[methodId].label}.</p>;
  return (
    <div>
      <p className="mb-5 text-[14px] text-ink-2">
        Show {g.items.length === 1 ? "this" : `these ${g.items.length}`} at the counter. {money(g.total)} back in total.
      </p>
      <div className="flex flex-col gap-4">
        {g.items.map(({ purchase, ret }, i) => (
          <div key={purchase.id} className="rounded-[24px] border border-line p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-muted">
                  {i + 1} of {g.items.length}
                </div>
                <RetailerLabel purchase={purchase} />
                <div className="text-[16px] font-semibold tracking-tight">{purchase.itemName}</div>
              </div>
              <div className="text-right">
                <div className="tabular font-semibold">{money(ret.refundAmount)}</div>
                {ret.simulated && <SimulatedTag />}
              </div>
            </div>
            <ReturnArtifactView purchase={purchase} ret={ret} size={160} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-line px-6 py-14 text-center">
      <div className="text-[16px] font-medium">{title}</div>
      <p className="mx-auto mt-1 max-w-sm text-[14px] text-muted">{body}</p>
    </div>
  );
}
