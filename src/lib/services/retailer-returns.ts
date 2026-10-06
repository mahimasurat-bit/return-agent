/**
 * MOCK / DEMO BEHAVIOR.
 *
 * Simulates a retailer return. Nothing is submitted to any retailer and the
 * generated code is a placeholder, not a real carrier code. The UI labels
 * every result produced here as "Simulated".
 *
 * Future: a browser agent (Playwright / computer use) opens the retailer site,
 * finds the order, selects item + reason + method, and retrieves the QR/label,
 * pausing for user confirmation before the final submit.
 */
import type { Purchase, ReturnArtifact, ReturnMethodId, ReturnReason } from "../types";
import { RETURN_METHODS } from "../retailers";

export interface SimulatedReturnRequest {
  purchase: Purchase;
  reason: ReturnReason;
  methodId: ReturnMethodId;
}

export const SIMULATED_STEPS = (p: Purchase) => [
  `Opening order ${p.orderNumber ?? ""}`.trim(),
  `Selecting ${p.itemName}`,
  "Choosing return reason",
  "Choosing drop-off method",
  "Generating return code",
];

function rand(n: number) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function simulateRetailerReturn(req: SimulatedReturnRequest): Promise<ReturnArtifact> {
  const m = RETURN_METHODS[req.methodId];
  const prefix = req.methodId === "fedex" ? "FX" : req.methodId === "usps" ? "US" : req.methodId === "ups" ? "1Z" : "RT";
  return {
    type: m.artifact,
    code: `${prefix}-DEMO-${rand(4)}-${rand(4)}`,
    trackingNumber: m.artifact === "label" ? `DEMO ${rand(4)} ${rand(4)}` : null,
  };
}
