"use client";

import { createContext, useContext } from "react";
import type { ReturnMethodId } from "@/lib/types";

export type InboxTab = "all" | "decide" | "return" | "dropoff" | "refunds";

export type SheetState =
  | { kind: "return"; id: string }
  | { kind: "email"; id: string }
  | { kind: "order"; id: string }
  | { kind: "codes"; methodId: ReturnMethodId }
  | { kind: "add" }
  | { kind: "review" }
  | { kind: "privacy" }
  | { kind: "account" }
  | null;

export interface UICtx {
  sheet: SheetState;
  openSheet: (s: SheetState) => void;
  closeSheet: () => void;
  tab: InboxTab;
  goToTab: (t: InboxTab, scroll?: boolean) => void;
}

export const UIContext = createContext<UICtx | null>(null);

export function useUI() {
  const c = useContext(UIContext);
  if (!c) throw new Error("useUI outside provider");
  return c;
}
