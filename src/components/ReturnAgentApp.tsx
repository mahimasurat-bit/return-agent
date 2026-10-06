"use client";

import { useCallback, useMemo, useState } from "react";
import { LayoutGrid, Mail, Plus, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";
import { StoreProvider, useActions, useStore } from "@/lib/store";
import { Onboarding } from "./Onboarding";
import { Discovery } from "./Discovery";
import { LayoutProvider, ModularDashboard, useLayoutEditing } from "./ModularDashboard";
import { ReturnFlow } from "./ReturnFlow";
import { CodesSheetBody } from "./DropOff";
import { AccountSheetBody, AddPurchaseBody, DigestSheetBody, EmailSheetBody, OrderSheetBody, PrivacySheetBody, ReviewSheetBody } from "./Sheets";
import { Button, Logo, Sheet } from "./ui";
import { UIContext, useUI, type InboxTab, type SheetState } from "./ui-context";
import { RETURN_METHODS, retailerOf } from "@/lib/retailers";

/** OAuth starts at an API route, so this must be a full page navigation. */
function reconnect() {
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign("/api/auth/google");
}

export function ReturnAgentApp() {
  return (
    <StoreProvider>
      <Root />
    </StoreProvider>
  );
}

function Root() {
  const { state, ready } = useStore();
  if (!ready) return <div className="min-h-dvh" />;
  if (state.stage === "onboarding") return <Onboarding />;
  if (state.stage === "discovery") return <Discovery />;
  return <MainApp />;
}

function MainApp() {
  const [sheet, setSheet] = useState<SheetState>(null);
  const [tab, setTab] = useState<InboxTab>("all");

  const goToTab = useCallback((t: InboxTab, scroll = true) => {
    setTab(t);
    if (scroll)
      requestAnimationFrame(() => document.getElementById("inbox")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, []);
  const closeSheet = useCallback(() => setSheet(null), []);

  const ui = useMemo(() => ({ sheet, openSheet: setSheet, closeSheet, tab, goToTab }), [sheet, closeSheet, tab, goToTab]);

  return (
    <UIContext.Provider value={ui}>
      <LayoutProvider>
      <div className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
        <Header />
        <ModularDashboard />
        <Footer />
      </div>
      <Sheets />
      </LayoutProvider>
    </UIContext.Provider>
  );
}

function Header() {
  const { state } = useStore();
  const ui = useUI();
  const { editing, setEditing } = useLayoutEditing();
  return (
    <>
      <header className="flex items-center justify-between gap-4 py-6 sm:py-8">
        <div className="flex items-center gap-3">
          <Logo size={36} />
          <div>
            <div className="text-[16px] font-semibold leading-tight tracking-tight">Return Agent</div>
            <div className="text-[13px] leading-tight text-muted">Never miss a return again.</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {state.mode === "live" ? (
            <LiveStatus />
          ) : (
            <button
              onClick={() => ui.openSheet({ kind: "privacy" })}
              className="hidden items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] text-muted transition hover:text-ink md:inline-flex"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-warn" />
              Demo inbox
              <ShieldCheck size={13} />
            </button>
          )}
          <Button size="sm" variant="secondary" onClick={() => ui.openSheet({ kind: "digest" })} aria-label="Email digest">
            <Mail size={15} />
            <span className="hidden sm:inline">Digest</span>
          </Button>
          <Button
            size="sm"
            variant={editing ? "primary" : "secondary"}
            onClick={() => setEditing(!editing)}
            aria-label="Customize dashboard"
            aria-pressed={editing}
          >
            <LayoutGrid size={15} />
            <span className="hidden sm:inline">{editing ? "Done" : "Customize"}</span>
          </Button>
          <Button size="sm" onClick={() => ui.openSheet({ kind: "add" })} aria-label="Add purchase">
            <Plus size={16} />
            <span className="hidden sm:inline">Add purchase</span>
          </Button>
        </div>
      </header>
      {state.mode === "live" && state.account?.needsReauth && (
        <div className="mb-4 flex flex-col gap-3 rounded-[22px] border border-[#f3d6d1] bg-urgent-bg px-5 py-4 text-[14px] text-urgent sm:flex-row sm:items-center sm:justify-between">
          Gmail access expired, so Return Agent can’t check for new purchases or refunds.
          <Button size="sm" variant="danger" onClick={reconnect}>
            Reconnect Gmail
          </Button>
        </div>
      )}
      <SyncToast />
    </>
  );
}

function ago(iso: string | null) {
  if (!iso) return "not synced yet";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "synced just now";
  if (m < 60) return `synced ${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `synced ${h} hr ago`;
  return `synced ${Math.round(h / 24)} d ago`;
}

function LiveStatus() {
  const { state, sync, runSync } = useStore();
  const ui = useUI();
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => ui.openSheet({ kind: "account" })}
        className="hidden max-w-[320px] items-center gap-2 truncate rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] text-muted transition hover:text-ink md:inline-flex"
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-money" />
        <span className="truncate">
          {state.account?.email} · {sync.running ? "syncing…" : ago(state.account?.lastSyncedAt ?? null)}
        </span>
        <ShieldCheck size={13} className="shrink-0" />
      </button>
      <Button size="sm" variant="secondary" onClick={() => runSync()} disabled={sync.running} aria-label="Sync Gmail">
        <RefreshCw size={15} className={sync.running ? "animate-spin" : ""} />
        <span className="hidden sm:inline">{sync.running ? "Syncing" : "Sync"}</span>
      </Button>
      <button
        onClick={() => ui.openSheet({ kind: "account" })}
        className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface text-muted hover:text-ink md:hidden"
        aria-label="Account"
      >
        <ShieldCheck size={15} />
      </button>
    </div>
  );
}

/** Small status line under the header after a manual sync. */
function SyncToast() {
  const { state, sync } = useStore();
  if (state.mode !== "live" || state.stage !== "app") return null;
  if (sync.running)
    return (
      <div className="mb-4 flex items-center gap-2 text-[13px] text-muted">
        <span className="h-3.5 w-3.5 rounded-full border-2 border-line border-t-ink animate-spin" />
        {sync.log.at(-1) ?? "Checking Gmail"}
        {sync.progress && ` · ${sync.progress.done}/${sync.progress.total}`}
      </div>
    );
  if (sync.error) return <div className="mb-4 text-[13px] text-urgent">Sync failed: {sync.error}</div>;
  if (sync.result)
    return (
      <div className="mb-4 text-[13px] text-muted">
        {sync.result.newPurchases
          ? `Found ${sync.result.newPurchases} new ${sync.result.newPurchases === 1 ? "purchase" : "purchases"}.`
          : "Up to date. No new purchases."}
        {sync.result.shopping > 0 && ` Read ${sync.result.shopping} shopping ${sync.result.shopping === 1 ? "email" : "emails"}.`}
        {sync.result.more && " More emails left; sync again to continue."}
      </div>
    );
  return null;
}

function Footer() {
  const { state } = useStore();
  const { reset } = useActions();
  return (
    <footer className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-line pt-6 text-[12px] text-faint sm:flex-row sm:items-center">
      <span>
        {state.mode === "live"
          ? "Purchases come from your Gmail. Return submission to retailers is simulated for now and labeled as such."
          : "Demo data is fictional; retailer return steps are simulated and labeled as such."}
      </span>
      {state.mode === "demo" && (
        <button onClick={reset} className="inline-flex items-center gap-1.5 hover:text-ink">
          <RotateCcw size={12} />
          Exit demo
        </button>
      )}
    </footer>
  );
}

function Sheets() {
  const ui = useUI();
  const { state } = useStore();
  const s = ui.sheet;
  const close = ui.closeSheet;
  const purchase = s && "id" in s ? state.purchases.find((p) => p.id === s.id) : undefined;

  return (
    <>
      <Sheet open={s?.kind === "return"} onClose={close} title={purchase ? `${retailerOf(purchase).name} return` : "Return"}>
        {s?.kind === "return" && <ReturnFlow key={s.id} id={s.id} />}
      </Sheet>
      <Sheet open={s?.kind === "email"} onClose={close} title="Source email" wide>
        {s?.kind === "email" && <EmailSheetBody key={s.id} id={s.id} />}
      </Sheet>
      <Sheet open={s?.kind === "order"} onClose={close} title="Order details">
        {s?.kind === "order" && <OrderSheetBody id={s.id} />}
      </Sheet>
      <Sheet open={s?.kind === "codes"} onClose={close} title={s?.kind === "codes" ? `${RETURN_METHODS[s.methodId].label} returns` : ""}>
        {s?.kind === "codes" && <CodesSheetBody methodId={s.methodId} />}
      </Sheet>
      <Sheet open={s?.kind === "add"} onClose={close} title="Add a purchase">
        {s?.kind === "add" && <AddPurchaseBody />}
      </Sheet>
      <Sheet open={s?.kind === "review"} onClose={close} title="Review returns">
        {s?.kind === "review" && <ReviewSheetBody />}
      </Sheet>
      <Sheet open={s?.kind === "digest"} onClose={close} title="Your digest" wide>
        {s?.kind === "digest" && <DigestSheetBody />}
      </Sheet>
      <Sheet open={s?.kind === "account"} onClose={close} title="Gmail connection">
        {s?.kind === "account" && <AccountSheetBody />}
      </Sheet>
      <Sheet open={s?.kind === "privacy"} onClose={close} title="What Return Agent reads">
        {s?.kind === "privacy" && <PrivacySheetBody />}
      </Sheet>
    </>
  );
}

