"use client";

/**
 * Modular dashboard: every section is a module the viewer can reorder (drag),
 * resize (half / full width) or hide. The layout is saved per browser and can
 * be shared as a link (?layout=...), so testers can send back the arrangement
 * they prefer.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, Columns2, EyeOff, GripVertical, Link2, Plus, RotateCcw, Square } from "lucide-react";
import { AgentActivityFeed, AgentInsight, AttentionAlert, ReturnsInbox, SummaryHero, TrustNote } from "./Dashboard";
import { Button, cx } from "./ui";

type ModuleId = "summary" | "insight" | "attention" | "inbox" | "activity" | "trust";
type Width = "half" | "full";
interface Slot {
  id: ModuleId;
  width: Width;
}

const MODULES: Record<ModuleId, { label: string; render: () => ReactNode; resizable: boolean; section?: boolean; tall?: boolean }> = {
  summary: { label: "Money summary", render: () => <SummaryHero />, resizable: true },
  insight: { label: "Agent recommendation", render: () => <AgentInsight />, resizable: true },
  attention: { label: "Needs attention", render: () => <AttentionAlert />, resizable: true },
  inbox: { label: "Returns Inbox", render: () => <ReturnsInbox />, resizable: false, section: true, tall: true },
  activity: { label: "What Return Agent handled", render: () => <AgentActivityFeed />, resizable: false, section: true, tall: true },
  trust: { label: "Privacy note", render: () => <TrustNote />, resizable: true },
};
const ALL_IDS = Object.keys(MODULES) as ModuleId[];

const DEFAULT_LAYOUT: Slot[] = [
  { id: "summary", width: "half" },
  { id: "insight", width: "half" },
  { id: "attention", width: "full" },
  { id: "inbox", width: "full" },
  { id: "activity", width: "full" },
  { id: "trust", width: "full" },
];

const STORAGE_KEY = "return-agent:layout:v1";

function encode(layout: Slot[]) {
  return layout.map((s) => (s.width === "half" ? `${s.id}.h` : s.id)).join(",");
}

function decode(raw: string | null): Slot[] | null {
  if (!raw) return null;
  const seen = new Set<string>();
  const out: Slot[] = [];
  for (const part of raw.split(",")) {
    const [id, w] = part.split(".");
    if (!(id in MODULES) || seen.has(id)) continue;
    seen.add(id);
    out.push({ id: id as ModuleId, width: w === "h" && MODULES[id as ModuleId].resizable ? "half" : "full" });
  }
  return out.length ? out : null;
}

/* ── Layout state (shared with the header's Customize button) ── */

interface LayoutCtx {
  editing: boolean;
  setEditing: (v: boolean) => void;
}
const LayoutContext = createContext<LayoutCtx>({ editing: false, setEditing: () => undefined });
export const useLayoutEditing = () => useContext(LayoutContext);

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [editing, setEditing] = useState(false);
  const value = useMemo(() => ({ editing, setEditing }), [editing]);
  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

function useLayout() {
  const [layout, setLayout] = useState<Slot[]>(DEFAULT_LAYOUT);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = decode(params.get("layout"));
    let next: Slot[] | null = fromUrl;
    if (fromUrl) {
      params.delete("layout");
      const q = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (q ? `?${q}` : ""));
    } else {
      try {
        next = decode(localStorage.getItem(STORAGE_KEY));
      } catch {
        /* storage unavailable */
      }
    }
    if (next) {
      const restored = next;
      // Restoring saved/shared state after mount (localStorage and URL aren't available during SSR).
      queueMicrotask(() => {
        setLayout(restored);
        if (fromUrl) setShared(true);
      });
    }
  }, []);

  const save = useCallback((l: Slot[]) => {
    setLayout(l);
    try {
      localStorage.setItem(STORAGE_KEY, encode(l));
    } catch {
      /* ignore */
    }
  }, []);

  return { layout, save, shared, dismissShared: () => setShared(false) };
}

/* ── Dashboard ───────────────────────────────────────────── */

export function ModularDashboard() {
  const { editing, setEditing } = useLayoutEditing();
  const { layout, save, shared, dismissShared } = useLayout();
  const [toast, setToast] = useState<string | null>(null);
  const hidden = ALL_IDS.filter((id) => !layout.some((s) => s.id === id));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = layout.findIndex((s) => s.id === e.active.id);
    const to = layout.findIndex((s) => s.id === e.over!.id);
    save(arrayMove(layout, from, to));
  };

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/?layout=${encode(layout)}`;
    try {
      await navigator.clipboard.writeText(url);
      flash("Layout link copied. Paste it in your reply to share this arrangement.");
    } catch {
      window.prompt("Copy this layout link", url);
    }
  };

  return (
    <div>
      {shared && !editing && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-info/30 bg-info-bg px-5 py-3 text-[14px] text-info">
          You’re viewing a shared dashboard layout.
          <span className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              Customize
            </Button>
            <Button size="sm" variant="ghost" onClick={dismissShared}>
              Got it
            </Button>
          </span>
        </div>
      )}

      {editing && (
        <div className="sticky top-[env(safe-area-inset-top,0px)] z-30 -mx-2 mb-5 rounded-[22px] border border-ink/10 bg-surface/95 p-4 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.25)] backdrop-blur sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[15px] font-semibold tracking-tight">Customize your dashboard</div>
              <div className="text-[13px] text-muted">Drag modules to reorder. Resize or hide them. Saved in this browser.</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" onClick={() => save(DEFAULT_LAYOUT)}>
                <RotateCcw size={14} />
                Reset
              </Button>
              <Button size="sm" variant="secondary" onClick={copyLink}>
                <Link2 size={14} />
                Copy layout link
              </Button>
              <Button size="sm" onClick={() => setEditing(false)}>
                <Check size={14} />
                Done
              </Button>
            </div>
          </div>
          {hidden.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line-2 pt-3 text-[12px] text-muted">
              Hidden:
              {hidden.map((id) => (
                <button
                  key={id}
                  onClick={() => save([...layout, { id, width: MODULES[id].resizable ? "half" : "full" }])}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-3 py-1 font-medium text-ink-2 hover:border-ink hover:text-ink"
                >
                  <Plus size={12} />
                  {MODULES[id].label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={layout.map((s) => s.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 animate-fade-up">
            {layout.map((slot, i) => (
              <ModuleFrame
                key={slot.id}
                slot={slot}
                editing={editing}
                spaced={!editing && MODULES[slot.id].section && i > 0}
                onResize={() => save(layout.map((s) => (s.id === slot.id ? { ...s, width: s.width === "half" ? "full" : "half" } : s)))}
                onHide={() => save(layout.filter((s) => s.id !== slot.id))}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {toast && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+20px)] left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-5 py-3 text-[13px] text-white shadow-lg animate-sheet">
          {toast}
        </div>
      )}
    </div>
  );
}

function ModuleFrame({
  slot,
  editing,
  spaced,
  onResize,
  onHide,
}: {
  slot: Slot;
  editing: boolean;
  spaced?: boolean;
  onResize: () => void;
  onHide: () => void;
}) {
  const m = MODULES[slot.id];
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: slot.id,
    disabled: !editing,
  });

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cx(
        "min-w-0",
        slot.width === "full" && "lg:col-span-2",
        spaced && "mt-10",
        editing && "relative rounded-[30px] outline-2 outline-dashed outline-ink/20 outline-offset-4",
        isDragging && "z-20 opacity-90 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.3)]",
      )}
    >
      {editing && (
        <div className="absolute -top-3 left-4 right-4 z-10 flex items-center justify-between gap-2">
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            className="inline-flex cursor-grab touch-none items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[12px] font-medium text-white shadow active:cursor-grabbing"
            aria-label={`Drag ${m.label}`}
          >
            <GripVertical size={14} />
            {m.label}
          </button>
          <span className="flex gap-1.5">
            {m.resizable && (
              <button
                onClick={onResize}
                className="hidden items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink-2 shadow-sm hover:text-ink lg:inline-flex"
                aria-label={slot.width === "half" ? "Make full width" : "Make half width"}
              >
                {slot.width === "half" ? <Square size={13} /> : <Columns2 size={13} />}
                {slot.width === "half" ? "Full" : "Half"}
              </button>
            )}
            <button
              onClick={onHide}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink-2 shadow-sm hover:text-urgent"
              aria-label={`Hide ${m.label}`}
            >
              <EyeOff size={13} />
              Hide
            </button>
          </span>
        </div>
      )}
      <div
        className={cx(
          editing && "pointer-events-none select-none",
          editing && m.section && "pt-7",
          editing && m.tall && "max-h-[340px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_70%,transparent)]",
          editing && "min-h-[96px] rounded-[28px] bg-surface/40",
        )}
      >
        {m.render()}
      </div>
    </section>
  );
}
