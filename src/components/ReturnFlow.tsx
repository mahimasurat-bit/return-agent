"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Info } from "lucide-react";
import { Button, ProductTile, RetailerLabel, SimulatedTag, cx } from "./ui";
import { ReturnArtifactView } from "./ReturnCode";
import { useUI } from "./ui-context";
import { fmtDay, money, daysUntil, relativeDays } from "@/lib/dates";
import { RETURN_METHODS, retailerOf } from "@/lib/retailers";
import { useActions, useStore } from "@/lib/store";
import { dropOffGroups, returnFor } from "@/lib/selectors";
import { SIMULATED_STEPS, simulateRetailerReturn } from "@/lib/services/retailer-returns";
import type { ReturnMethodId, ReturnReason } from "@/lib/types";

const REASONS: ReturnReason[] = [
  "Too small",
  "Too large",
  "Didn't like it",
  "Changed my mind",
  "Quality issue",
  "Arrived damaged",
  "Other",
];

type Step = "reason" | "method" | "confirm" | "working" | "ready";

export function ReturnFlow({ id }: { id: string }) {
  const { state } = useStore();
  const { completeReturn, droppedOff } = useActions();
  const { closeSheet, goToTab } = useUI();
  const p = state.purchases.find((x) => x.id === id);
  const existing = returnFor(state, id);

  const [step, setStep] = useState<Step>(p?.status === "ready_to_drop_off" ? "ready" : "reason");
  const [reason, setReason] = useState<ReturnReason | null>(null);
  const [note, setNote] = useState("");
  const [method, setMethod] = useState<ReturnMethodId | null>(null);
  const [progress, setProgress] = useState(0);
  const [confirmDrop, setConfirmDrop] = useState(false);
  const submitted = useRef(false);

  const steps = p ? SIMULATED_STEPS(p) : [];

  useEffect(() => {
    if (step !== "working" || !p || !reason || !method) return;
    if (progress < steps.length) {
      const t = setTimeout(() => setProgress((n) => n + 1), 600);
      return () => clearTimeout(t);
    }
    if (submitted.current) return;
    submitted.current = true;
    // MOCK: simulated retailer interaction, see services/retailer-returns.ts
    simulateRetailerReturn({ purchase: p, reason, methodId: method }).then((artifact) => {
      completeReturn({ id: p.id, reason, note: reason === "Other" ? note || null : null, methodId: method, artifact });
      setTimeout(() => setStep("ready"), 350);
    });
  }, [step, progress, steps.length, p, reason, method, note, completeReturn]);

  if (!p) return null;
  const retailer = retailerOf(p);
  const groups = dropOffGroups(state);
  const groupFor = (m: ReturnMethodId) => groups.find((g) => g.methodId === m && g.items.some((i) => i.purchase.id !== p.id));

  const header = (
    <div className="mb-6 flex items-center gap-4">
      <ProductTile purchase={p} size={56} />
      <div className="min-w-0 flex-1">
        <RetailerLabel purchase={p} />
        <div className="truncate text-[16px] font-semibold tracking-tight">{p.itemName}</div>
        <div className="text-[13px] text-muted">
          {money(p.price)}
          {p.returnDeadline && ` · return by ${fmtDay(p.returnDeadline)}`}
        </div>
      </div>
    </div>
  );

  if (step === "reason")
    return (
      <div>
        {header}
        <StepTitle n={1} title="Why are you returning this?" />
        <div className="grid grid-cols-2 gap-2">
          {REASONS.map((r) => (
            <Choice key={r} selected={reason === r} onClick={() => setReason(r)}>
              {r}
            </Choice>
          ))}
        </div>
        {reason === "Other" && (
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a short note (optional)"
            rows={2}
            className="mt-3 w-full resize-none rounded-2xl border border-line bg-canvas px-4 py-3 text-[14px] outline-none focus:border-ink"
          />
        )}
        <Button size="lg" className="mt-6 w-full" disabled={!reason} onClick={() => setStep("method")}>
          Continue
        </Button>
      </div>
    );

  if (step === "method")
    return (
      <div>
        {header}
        <StepTitle n={2} title="How would you like to return it?" onBack={() => setStep("reason")} />
        <div className="flex flex-col gap-2">
          {retailer.methods.map((m) => {
            const info = RETURN_METHODS[m];
            const g = groupFor(m);
            return (
              <Choice key={m} selected={method === m} onClick={() => setMethod(m)} block>
                <div className="flex w-full items-start justify-between gap-3 text-left">
                  <div>
                    <div className="text-[15px] font-medium">{info.label}</div>
                    <div className="mt-0.5 text-[12px] font-normal text-muted">
                      {info.artifact === "qr" ? "QR code, no printing" : "Printable label"}
                    </div>
                  </div>
                  {g && (
                    <span className="shrink-0 rounded-full bg-money-bg px-2.5 py-1 text-[11px] font-medium text-money">
                      Joins {g.items.length} other {g.items.length === 1 ? "return" : "returns"}
                    </span>
                  )}
                </div>
              </Choice>
            );
          })}
        </div>
        <p className="mt-3 flex items-start gap-1.5 text-[12px] text-faint">
          <Info size={13} className="mt-0.5 shrink-0" />
          Return options shown are demo data, not verified {retailer.name} policy.
        </p>
        <Button size="lg" className="mt-6 w-full" disabled={!method} onClick={() => setStep("confirm")}>
          Continue
        </Button>
      </div>
    );

  if (step === "confirm" && reason && method)
    return (
      <div>
        {header}
        <StepTitle n={3} title="Review and start return" onBack={() => setStep("method")} />
        <dl className="divide-y divide-line-2 rounded-2xl border border-line">
          <Row k="Reason" v={reason === "Other" && note ? `Other: ${note}` : reason} />
          <Row k="Return at" v={RETURN_METHODS[method].label} />
          <Row k="Refund" v={money(p.price)} />
          <Row k="Return by" v={p.returnDeadline ? fmtDay(p.returnDeadline) : "Needs verification"} />
          <Row k="Order" v={p.orderNumber ? `#${p.orderNumber}` : "Needs verification"} />
        </dl>
        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-canvas p-4 text-[13px] leading-relaxed text-ink-2">
          <SimulatedTag className="mt-0.5 shrink-0" />
          <span>
            Demo mode. Return Agent will simulate the {retailer.name} return flow and create a placeholder code. Nothing is
            submitted to {retailer.name}.
          </span>
        </div>
        <Button size="lg" className="mt-6 w-full" onClick={() => setStep("working")}>
          Start return
        </Button>
      </div>
    );

  if (step === "working")
    return (
      <div>
        {header}
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-[19px] font-semibold tracking-tight">Starting your {retailer.name} return</h3>
          <SimulatedTag />
        </div>
        <ul className="flex flex-col gap-3.5">
          {steps.map((s, i) => (
            <li key={s} className={cx("flex items-center gap-3 text-[15px] transition", i > progress && "opacity-35")}>
              {i < progress ? (
                <span className="grid h-5 w-5 place-items-center rounded-full bg-money-bg text-money">
                  <Check size={12} strokeWidth={3} />
                </span>
              ) : i === progress ? (
                <span className="h-5 w-5 rounded-full border-2 border-line border-t-ink animate-spin" />
              ) : (
                <span className="h-5 w-5 rounded-full border-2 border-line" />
              )}
              {s}
            </li>
          ))}
        </ul>
      </div>
    );

  // READY
  const ret = existing;
  if (!ret) return null;
  const group = groups.find((g) => g.methodId === ret.methodId);
  const others = group ? group.items.filter((i) => i.purchase.id !== p.id).length : 0;
  const d = p.returnDeadline ? daysUntil(p.returnDeadline) : null;

  return (
    <div className="flex flex-col">
      <div className="mb-1 flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-money text-white">
          <Check size={14} strokeWidth={3} />
        </span>
        <span className="text-[13px] font-medium text-money">Return ready</span>
        {ret.simulated && <SimulatedTag className="ml-auto" />}
      </div>
      <h3 className="mt-2 text-[24px] font-semibold tracking-tight">{p.itemName}</h3>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat k="Refund" v={money(ret.refundAmount)} />
        <Stat k="Return at" v={RETURN_METHODS[ret.methodId].label} />
      </div>

      <div className="my-6">
        <ReturnArtifactView purchase={p} ret={ret} />
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-canvas px-4 py-3 text-[14px]">
        <span className="text-ink-2">Return by {p.returnDeadline ? fmtDay(p.returnDeadline) : "(needs verification)"}</span>
        {d !== null && <span className={cx("font-medium", d <= 4 ? "text-urgent" : "text-ink")}>{relativeDays(d)}</span>}
      </div>
      {others > 0 && (
        <p className="mt-3 text-center text-[13px] text-money">
          Added to your {RETURN_METHODS[ret.methodId].shortLabel} trip with {others} other {others === 1 ? "item" : "items"}.
        </p>
      )}

      {confirmDrop ? (
        <div className="mt-5 rounded-2xl border border-line p-4">
          <p className="text-[14px] font-medium">Did you drop off {p.itemName} at {RETURN_METHODS[ret.methodId].label}?</p>
          <p className="mt-1 text-[13px] text-muted">Return Agent will start watching for your refund.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setConfirmDrop(false)}>
              Not yet
            </Button>
            <Button
              onClick={() => {
                droppedOff([p.id]);
                closeSheet();
                goToTab("refunds");
              }}
            >
              Yes, dropped off
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              closeSheet();
              goToTab("dropoff");
            }}
          >
            View trip
          </Button>
          <Button onClick={() => setConfirmDrop(true)}>Mark as dropped off</Button>
        </div>
      )}
    </div>
  );
}

function StepTitle({ n, title, onBack }: { n: number; title: string; onBack?: () => void }) {
  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center gap-2 text-[12px] font-medium text-muted">
        {onBack && (
          <button onClick={onBack} className="-ml-1 grid h-6 w-6 place-items-center rounded-full hover:bg-black/5" aria-label="Back">
            <ArrowLeft size={14} />
          </button>
        )}
        Step {n} of 3
      </div>
      <h3 className="text-[19px] font-semibold tracking-tight">{title}</h3>
    </div>
  );
}

function Choice({
  selected,
  onClick,
  children,
  block,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  block?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "rounded-2xl border px-4 text-[14px] font-medium transition",
        block ? "flex py-3.5" : "h-12",
        selected ? "border-ink bg-ink text-white [&_.text-muted]:text-white/60" : "border-line bg-white hover:border-[#cfcdc5]",
      )}
    >
      {children}
    </button>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 text-[14px]">
      <dt className="text-muted">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl border border-line px-4 py-3">
      <div className="text-[12px] text-muted">{k}</div>
      <div className="tabular mt-0.5 text-[17px] font-semibold tracking-tight">{v}</div>
    </div>
  );
}
