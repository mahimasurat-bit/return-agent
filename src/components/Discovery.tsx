"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowRight, Check, Mail } from "lucide-react";
import { Button, Logo, cx } from "./ui";
import { useActions, useStore } from "@/lib/store";

const STEP_MS = 520;

export function Discovery() {
  const { state } = useStore();
  return state.mode === "live" ? <LiveDiscovery /> : <DemoDiscovery />;
}

/* ── Real Gmail: stream the server's sync log ─────────────── */

function LiveDiscovery() {
  const { state, sync, runSync } = useStore();
  const { finishDiscovery } = useActions();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    runSync();
  }, [runSync]);

  const done = !sync.running && (!!sync.result || !!sync.error);
  const retailers = new Set(state.purchases.map((p) => p.retailer)).size;
  const n = state.purchases.length;

  return (
    <Frame badge={state.account?.email ?? "Gmail"} done={done && !sync.error} error={!!sync.error}>
      {sync.error ? (
        <Heading title="Sync didn’t finish" sub={sync.error} />
      ) : done ? (
        <Heading
          title={n === 1 ? "1 purchase found" : `${n} purchases found`}
          sub={
            n
              ? `Across ${retailers} ${retailers === 1 ? "retailer" : "retailers"}. Your Returns Inbox is ready.${sync.result?.more ? " More older emails will be read on the next sync." : ""}`
              : "No purchases in the last 60 days of shopping email. Add one manually, or sync again later."
          }
        />
      ) : (
        <Heading
          title="Finding your purchases…"
          sub="Reading order confirmations, shipping, return and refund emails. Nothing else."
        />
      )}

      <ul className="mt-9 flex flex-col gap-3.5">
        {sync.log.map((line, i) => (
          <LogLine key={i} text={line} />
        ))}
        {sync.running && (
          <li className="flex items-center gap-3 text-[15px] text-faint">
            <span className="h-5 w-5 shrink-0 rounded-full border-2 border-line border-t-ink animate-spin" />
            {sync.progress ? `Reading email ${sync.progress.done} of ${sync.progress.total}` : "Connecting to Gmail"}
          </li>
        )}
      </ul>

      <div className={cx("mt-10 flex flex-wrap gap-3 transition-opacity duration-500", done ? "opacity-100" : "pointer-events-none opacity-0")}>
        {sync.error && (
          <Button size="lg" variant="secondary" onClick={() => runSync()}>
            Try again
          </Button>
        )}
        <Button size="lg" onClick={finishDiscovery} className="w-full sm:w-auto">
          {n ? "Review purchases" : "Open Return Agent"}
          <ArrowRight size={17} />
        </Button>
      </div>
    </Frame>
  );
}

/* ── Demo: replay the fixture log ─────────────────────────── */

function DemoDiscovery() {
  const { state } = useStore();
  const { finishDiscovery } = useActions();
  const log = state.discoveryLog;
  const [shown, setShown] = useState(0);
  const done = shown >= log.length;

  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 900 : STEP_MS);
    return () => clearTimeout(t);
  }, [shown, done]);

  const retailers = new Set(state.purchases.map((p) => p.retailer)).size;
  const codes = state.returns.filter((r) => !r.droppedOffAt).length;
  const refunds = state.refunds.filter((r) => r.status === "received").length;

  return (
    <Frame badge="Demo inbox" done={done}>
      {done ? (
        <Heading
          title={`${state.purchases.length} purchases found`}
          sub={`Across ${retailers} retailers. ${codes} return codes saved and ${refunds} refunds detected. Your Returns Inbox is ready.`}
        />
      ) : (
        <Heading title="Finding your purchases…" sub="Searching recent order confirmations and shipping emails." />
      )}
      <ul className="mt-9 flex flex-col gap-3.5">
        {log.slice(0, shown).map((line, i) => (
          <LogLine key={i} text={line} />
        ))}
        {!done && (
          <li className="flex items-center gap-3 text-[15px] text-faint">
            <span className="h-5 w-5 shrink-0 rounded-full border-2 border-line border-t-ink animate-spin" />
            Reading shopping emails
          </li>
        )}
      </ul>
      <div className={cx("mt-10 transition-opacity duration-500", done ? "opacity-100" : "pointer-events-none opacity-0")}>
        <Button size="lg" onClick={finishDiscovery} className="w-full sm:w-auto">
          Review purchases
          <ArrowRight size={17} />
        </Button>
      </div>
    </Frame>
  );
}

/* ── Shared pieces ────────────────────────────────────────── */

function Frame({ badge, done, error, children }: { badge: string; done: boolean; error?: boolean; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 sm:px-8">
      <header className="flex items-center justify-between gap-3 py-6">
        <div className="flex items-center gap-2.5">
          <Logo size={30} />
          <span className="text-[15px] font-semibold tracking-tight">Return Agent</span>
        </div>
        <span className="truncate rounded-full border border-line bg-white px-3 py-1 text-[12px] text-muted">{badge}</span>
      </header>
      <div className="flex flex-1 flex-col justify-center pb-20">
        <div className="relative mb-8 grid h-16 w-16 place-items-center">
          {!done && !error && <span className="absolute inset-0 rounded-full bg-ink/10 animate-ping-soft" />}
          <div
            className={cx(
              "relative grid h-16 w-16 place-items-center rounded-full text-white transition-colors duration-500",
              error ? "bg-urgent" : done ? "bg-money" : "bg-ink",
            )}
          >
            {error ? <AlertCircle size={28} /> : done ? <Check size={28} strokeWidth={2.5} /> : <Mail size={26} />}
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}

function Heading({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="animate-fade-up">
      <h1 className="tabular text-[34px] font-semibold leading-tight tracking-[-0.03em] sm:text-[44px]">{title}</h1>
      <p className="mt-3 text-[16px] text-ink-2">{sub}</p>
    </div>
  );
}

function LogLine({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-3 text-[15px] animate-fade-up">
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-money-bg text-money">
        <Check size={12} strokeWidth={3} />
      </span>
      {text}
    </li>
  );
}
