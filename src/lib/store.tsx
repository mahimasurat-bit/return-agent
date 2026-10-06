"use client";

/**
 * Client app store.
 *
 * Two modes:
 *  - demo: fixture data, kept in localStorage, clock pinned to the demo date.
 *  - live: your real Gmail. Data lives on the server (Supabase or a local file);
 *    every action is applied optimistically here and persisted via /api/actions.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { buildDemoDataset } from "./fixtures/demo-data";
import { nowISO, setDemoClock } from "./dates";
import { applyDataAction, DATA_ACTION_TYPES, EMPTY_DATA, type DataAction, type DataState } from "./domain";
import type { Purchase, ReturnArtifact, ReturnMethodId, ReturnReason } from "./types";

export type Stage = "onboarding" | "discovery" | "app";
export type Mode = "demo" | "live";

export interface Account {
  email: string;
  lastSyncedAt: string | null;
  needsReauth: boolean;
}

export interface ServerConfig {
  /** The server is reachable and Gmail OAuth env vars are set. */
  gmail: boolean;
  extraction: boolean;
  digest?: boolean;
  storage: string;
  missing: string[];
}

export interface AppState extends DataState {
  stage: Stage;
  mode: Mode | null;
  discoveryLog: string[];
  account: Account | null;
}

const initialState: AppState = {
  stage: "onboarding",
  mode: null,
  discoveryLog: [],
  account: null,
  ...EMPTY_DATA,
};

type Action =
  | DataAction
  | { type: "hydrate"; state: AppState }
  | { type: "setData"; data: DataState }
  | { type: "setAccount"; account: Account | null }
  | { type: "startDemo" }
  | { type: "startLiveDiscovery" }
  | { type: "finishDiscovery" }
  | { type: "reset" };

function reducer(s: AppState, a: Action): AppState {
  if (DATA_ACTION_TYPES.has(a.type as DataAction["type"])) return applyDataAction(s, a as DataAction);
  switch (a.type) {
    case "hydrate":
      return a.state;
    case "setData":
      return { ...s, ...a.data };
    case "setAccount":
      return { ...s, account: a.account };
    case "startDemo": {
      const data = buildDemoDataset(nowISO());
      return { ...s, ...data, stage: "discovery", mode: "demo" };
    }
    case "startLiveDiscovery":
      return { ...s, stage: "discovery", mode: "live", discoveryLog: [] };
    case "finishDiscovery":
      return { ...s, stage: "app" };
    case "reset":
      return initialState;
    default:
      return s;
  }
}

const STORAGE_KEY = "return-agent:v2";

export interface SyncState {
  running: boolean;
  log: string[];
  progress: { done: number; total: number } | null;
  error: string | null;
  result: { newPurchases: number; shopping: number; skipped: number; errors: number; more: boolean } | null;
}

interface Ctx {
  state: AppState;
  ready: boolean;
  dispatch: (a: Action) => void;
  server: ServerConfig | null;
  authError: string | null;
  sync: SyncState;
  runSync: () => Promise<SyncState["result"]>;
}

const StoreContext = createContext<Ctx | null>(null);

async function getJSON<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    if (!(r.headers.get("content-type") ?? "").includes("json")) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [box, rawDispatch] = useReducer(
    (b: { state: AppState; ready: boolean }, a: Action) =>
      a.type === "hydrate" ? { state: a.state, ready: true } : { state: reducer(b.state, a), ready: b.ready },
    { state: initialState, ready: false },
  );
  const { state, ready } = box;
  const [server, setServer] = useState<ServerConfig | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [sync, setSync] = useState<SyncState>({ running: false, log: [], progress: null, error: null, result: null });
  const modeRef = useRef<Mode | null>(null);
  modeRef.current = state.mode;

  // Boot: live session first, then saved demo, then onboarding.
  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const err = params.get("error");
      if (err) setAuthError(err);
      const connected = params.get("connected") === "1";
      if (err || connected) window.history.replaceState(null, "", window.location.pathname);

      const session = await getJSON<{
        config: ServerConfig;
        signedIn: boolean;
        email: string | null;
        lastSyncedAt: string | null;
        needsReauth: boolean;
      }>("/api/session");
      if (session) setServer(session.config);

      if (session?.signedIn && session.email) {
        setDemoClock(false);
        const st = await getJSON<{ data: DataState }>("/api/state");
        const data = st?.data ?? EMPTY_DATA;
        const firstRun = connected || (!session.lastSyncedAt && data.purchases.length === 0);
        rawDispatch({
          type: "hydrate",
          state: {
            ...initialState,
            ...data,
            mode: "live",
            stage: firstRun ? "discovery" : "app",
            account: { email: session.email, lastSyncedAt: session.lastSyncedAt, needsReauth: session.needsReauth },
          },
        });
        return;
      }

      let saved: AppState | null = null;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) saved = { ...initialState, ...JSON.parse(raw) } as AppState;
      } catch {
        /* storage unavailable */
      }
      if (saved?.mode === "demo") {
        setDemoClock(true);
        rawDispatch({ type: "hydrate", state: saved });
      } else {
        rawDispatch({ type: "hydrate", state: initialState });
      }
    })();
  }, []);

  // Demo mode persists locally. Live mode persists on the server.
  useEffect(() => {
    if (!ready || state.mode !== "demo") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, ready]);

  const dispatch = useCallback((a: Action) => {
    if (a.type === "startDemo") setDemoClock(true);
    if (a.type === "reset") {
      setDemoClock(false);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
    rawDispatch(a);
    if (modeRef.current === "live" && DATA_ACTION_TYPES.has(a.type as DataAction["type"])) {
      fetch("/api/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: a }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { data?: DataState } | null) => j?.data && rawDispatch({ type: "setData", data: j.data }))
        .catch(() => undefined);
    }
  }, []);

  const runSync = useCallback(async () => {
    setSync({ running: true, log: [], progress: null, error: null, result: null });
    let result: SyncState["result"] = null;
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Sync failed");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line);
          if (ev.type === "log") setSync((s) => ({ ...s, log: [...s.log, ev.message] }));
          else if (ev.type === "progress") setSync((s) => ({ ...s, progress: { done: ev.done, total: ev.total } }));
          else if (ev.type === "error") throw new Error(ev.message);
          else if (ev.type === "done") {
            result = ev.result;
            rawDispatch({ type: "setData", data: ev.data });
            setSync((s) => ({ ...s, result: ev.result }));
            const session = await getJSON<{ email: string; lastSyncedAt: string | null; needsReauth: boolean }>("/api/session");
            if (session?.email)
              rawDispatch({
                type: "setAccount",
                account: { email: session.email, lastSyncedAt: session.lastSyncedAt, needsReauth: session.needsReauth },
              });
          }
        }
      }
      setSync((s) => ({ ...s, running: false }));
    } catch (e) {
      setSync((s) => ({ ...s, running: false, error: e instanceof Error ? e.message : "Sync failed" }));
    }
    return result;
  }, []);

  const value = useMemo(
    () => ({ state, dispatch, ready, server, authError, sync, runSync }),
    [state, dispatch, ready, server, authError, sync, runSync],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

export function useActions() {
  const { dispatch } = useStore();
  return useMemo(
    () => ({
      startDemo: () => dispatch({ type: "startDemo" }),
      startLiveDiscovery: () => dispatch({ type: "startLiveDiscovery" }),
      finishDiscovery: () => dispatch({ type: "finishDiscovery" }),
      keep: (id: string) => dispatch({ type: "keep", id }),
      undecide: (id: string) => dispatch({ type: "undecide", id }),
      markReturn: (id: string) => dispatch({ type: "markReturn", id }),
      completeReturn: (p: { id: string; reason: ReturnReason; note: string | null; methodId: ReturnMethodId; artifact: ReturnArtifact }) =>
        dispatch({ type: "completeReturn", ...p }),
      droppedOff: (ids: string[]) => dispatch({ type: "droppedOff", ids }),
      checkRefund: (id: string, simulated: boolean) => dispatch({ type: "checkRefund", id, simulated }),
      refundReceived: (id: string) => dispatch({ type: "refundReceived", id }),
      addPurchase: (purchase: Purchase) => dispatch({ type: "addPurchase", purchase }),
      setDeadline: (id: string, date: string) => dispatch({ type: "setDeadline", id, date }),
      reset: () => dispatch({ type: "reset" }),
    }),
    [dispatch],
  );
}
