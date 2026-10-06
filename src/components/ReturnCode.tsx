"use client";

/**
 * Return artifacts. When the retailer's own QR image was found in the return
 * email it is shown as-is. Otherwise the code is rendered as a QR so it can be
 * shown at a counter; demo codes are placeholders and labeled as such.
 */
import { RETURN_METHODS, retailerOf } from "@/lib/retailers";
import { fmtDay, money } from "@/lib/dates";
import QRCode from "qrcode";
import { useStore } from "@/lib/store";
import { DEMO_USER_ID } from "@/lib/fixtures/demo-data";
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

/** Renders the code as a real QR matrix (same encoding as the emailed QR image). */
export function PlaceholderQR({ value, size = 184 }: { value: string; size?: number }) {
  const { size: n, data } = QRCode.create(value, { errorCorrectionLevel: "M" }).modules;
  const cells: [number, number][] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (data[y * n + x]) cells.push([x, y]);
  return (
    <svg viewBox={`-2 -2 ${n + 4} ${n + 4}`} width={size} height={size} role="img" aria-label={`QR code for ${value}`} shapeRendering="crispEdges">
      <rect x={-2} y={-2} width={n + 4} height={n + 4} fill="#fff" />
      {cells.map(([x, y]) => (
        <rect key={`${x}.${y}`} x={x} y={y} width={1.02} height={1.02} fill="#111" />
      ))}
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
  const { state } = useStore();
  const method = RETURN_METHODS[ret.methodId];
  const isLabel = ret.artifact?.type === "label";
  const demo = purchase.userId === DEMO_USER_ID;
  const email = ret.emailSourceId ? state.emails.find((e) => e.id === ret.emailSourceId) : undefined;
  const gmailLink =
    email?.provider === "gmail" && email.externalMessageId
      ? `https://mail.google.com/mail/u/0/#all/${email.externalMessageId}`
      : null;
  const original = ret.artifact?.imageUrl;

  return (
    <div className="flex flex-col items-center gap-3">
      {isLabel && !original ? (
        <PlaceholderLabel purchase={purchase} ret={ret} />
      ) : (
        <div className="rounded-3xl border border-line bg-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
          {original ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={original} alt={`${retailerOf(purchase).name} return code`} style={{ maxWidth: size, maxHeight: size }} />
          ) : (
            <PlaceholderQR value={ret.artifact?.code ?? ret.id} size={size} />
          )}
        </div>
      )}
      {!isLabel && <div className="font-mono text-[13px] tracking-wider text-ink-2">{ret.artifact?.code}</div>}
      <p className="max-w-xs text-center text-[12px] leading-relaxed text-muted">
        {method.instructions}
        <br />
        <span className="text-faint">
          {demo || ret.simulated
            ? `Demo placeholder. Not a real ${isLabel ? "shipping label" : "return code"}.`
            : original
              ? `From your ${retailerOf(purchase).name} return email.`
              : "Made from the code in your return email. If the counter can’t scan it, show the original email."}
        </span>
      </p>
      {gmailLink && (
        <a href={gmailLink} target="_blank" rel="noreferrer" className="text-[13px] font-medium text-ink-2 underline underline-offset-4 hover:text-ink">
          Open the original return email
        </a>
      )}
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
