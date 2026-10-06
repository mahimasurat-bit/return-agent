"use client";

/**
 * PLACEHOLDER return artifacts.
 * The QR pattern is generated from the code string for visual realism only.
 * It is not a scannable or valid carrier code.
 */
import { RETURN_METHODS, retailerOf } from "@/lib/retailers";
import { fmtDay, money } from "@/lib/dates";
import type { Purchase, Return } from "@/lib/types";

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 1000) / 1000;
  };
}

export function PlaceholderQR({ value, size = 184 }: { value: string; size?: number }) {
  const n = 25;
  const rnd = hash(value);
  const cells: [number, number][] = [];
  const inFinder = (x: number, y: number) =>
    (x < 8 && y < 8) || (x >= n - 8 && y < 8) || (x < 8 && y >= n - 8);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!inFinder(x, y) && rnd() > 0.52) cells.push([x, y]);
  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width={7} height={7} rx={1.6} fill="#111" />
      <rect x={x + 1} y={y + 1} width={5} height={5} rx={1.1} fill="#fff" />
      <rect x={x + 2} y={y + 2} width={3} height={3} rx={0.8} fill="#111" />
    </g>
  );
  return (
    <svg viewBox={`-2 -2 ${n + 4} ${n + 4}`} width={size} height={size} role="img" aria-label="Placeholder return QR code">
      <rect x={-2} y={-2} width={n + 4} height={n + 4} rx={3} fill="#fff" />
      {cells.map(([x, y]) => (
        <rect key={`${x}.${y}`} x={x + 0.08} y={y + 0.08} width={0.84} height={0.84} rx={0.22} fill="#111" />
      ))}
      {finder(0, 0)}
      {finder(n - 7, 0)}
      {finder(0, n - 7)}
    </svg>
  );
}

function Barcode({ value }: { value: string }) {
  const rnd = hash(value);
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  while (x < 280) {
    const w = 1 + Math.floor(rnd() * 3.5);
    bars.push({ x, w });
    x += w + 1 + Math.floor(rnd() * 3);
  }
  return (
    <svg viewBox="0 0 280 56" className="h-14 w-full" preserveAspectRatio="none" aria-hidden>
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={56} fill="#111" />
      ))}
    </svg>
  );
}

export function PlaceholderLabel({ purchase, ret }: { purchase: Purchase; ret: Return }) {
  const method = RETURN_METHODS[ret.methodId];
  return (
    <div className="w-full max-w-[320px] rounded-xl border-2 border-ink bg-white p-4 font-mono text-[11px] leading-relaxed text-ink">
      <div className="flex items-start justify-between border-b-2 border-ink pb-2">
        <div className="text-lg font-bold tracking-tight">{method.shortLabel.toUpperCase()}</div>
        <div className="text-right">
          <div className="font-bold">RETURN</div>
          <div>PREPAID</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 border-b border-ink/30 py-2">
        <div>
          <div className="text-[9px] text-muted">FROM</div>
          <div>YOUR NAME</div>
          <div>YOUR ADDRESS</div>
        </div>
        <div>
          <div className="text-[9px] text-muted">TO</div>
          <div>{retailerOf(purchase).name.toUpperCase()} RETURNS</div>
          <div>RETURNS CENTER</div>
        </div>
      </div>
      <div className="py-3">
        <Barcode value={ret.artifact?.code ?? ret.id} />
        <div className="mt-1 text-center tracking-[0.2em]">{ret.artifact?.trackingNumber ?? ret.artifact?.code}</div>
      </div>
      <div className="flex justify-between border-t border-ink/30 pt-2">
        <span>REF {purchase.orderNumber ?? "—"}</span>
        <span>{ret.artifact?.code}</span>
      </div>
    </div>
  );
}

export function ReturnArtifactView({ purchase, ret, size = 184 }: { purchase: Purchase; ret: Return; size?: number }) {
  const method = RETURN_METHODS[ret.methodId];
  const isLabel = ret.artifact?.type === "label";
  return (
    <div className="flex flex-col items-center gap-3">
      {isLabel ? (
        <PlaceholderLabel purchase={purchase} ret={ret} />
      ) : (
        <div className="rounded-3xl border border-line bg-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
          <PlaceholderQR value={ret.artifact?.code ?? ret.id} size={size} />
        </div>
      )}
      {!isLabel && <div className="font-mono text-[13px] tracking-wider text-ink-2">{ret.artifact?.code}</div>}
      <p className="max-w-xs text-center text-[12px] leading-relaxed text-muted">
        {method.instructions}
        <br />
        <span className="text-faint">Demo placeholder. Not a real {isLabel ? "shipping label" : "return code"}.</span>
      </p>
    </div>
  );
}

export function ArtifactCaption({ purchase, ret }: { purchase: Purchase; ret: Return }) {
  return (
    <div className="text-center">
      <div className="text-[13px] text-muted">
        {retailerOf(purchase).name} · {money(ret.refundAmount)} refund
        {purchase.returnDeadline ? ` · return by ${fmtDay(purchase.returnDeadline)}` : ""}
      </div>
    </div>
  );
}
