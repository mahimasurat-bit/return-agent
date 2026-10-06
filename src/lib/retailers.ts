import type { Purchase, RetailerId, ReturnMethod, ReturnMethodId } from "./types";

export const RETURN_METHODS: Record<ReturnMethodId, ReturnMethod> = {
  ups: {
    id: "ups",
    label: "UPS Store",
    shortLabel: "UPS",
    artifact: "qr",
    instructions: "Show the QR code at the counter. No box or printer needed.",
  },
  fedex: {
    id: "fedex",
    label: "FedEx",
    shortLabel: "FedEx",
    artifact: "label",
    instructions: "Print the label and attach it to the package.",
  },
  usps: {
    id: "usps",
    label: "USPS",
    shortLabel: "USPS",
    artifact: "label",
    instructions: "Print the label, attach it, and drop at any post office.",
  },
  store: {
    id: "store",
    label: "Retail store",
    shortLabel: "Store",
    artifact: "qr",
    instructions: "Bring the item and show the return code at the register.",
  },
  other: {
    id: "other",
    label: "See return email",
    shortLabel: "Other",
    artifact: "none",
    instructions: "Drop-off details weren't stated clearly. Check the return email from the retailer.",
  },
  mail: {
    id: "mail",
    label: "Mail",
    shortLabel: "Mail",
    artifact: "label",
    instructions: "Print the prepaid label and schedule a pickup or drop at a carrier.",
  },
};

export interface RetailerInfo {
  id: RetailerId;
  name: string;
  domain: string;
  /**
   * DEMO CONFIG: return methods offered in the simulated flow.
   * These are illustrative and NOT verified retailer policy. In production this
   * comes from the return-policy service (src/lib/services/return-policy.ts).
   */
  demoMethods: ReturnMethodId[];
}

export const RETAILERS: Record<RetailerId, RetailerInfo> = {
  nike: { id: "nike", name: "Nike", domain: "nike.com", demoMethods: ["ups", "usps", "store"] },
  lululemon: { id: "lululemon", name: "Lululemon", domain: "lululemon.com", demoMethods: ["ups", "fedex", "store"] },
  nordstrom: { id: "nordstrom", name: "Nordstrom", domain: "nordstrom.com", demoMethods: ["ups", "usps", "store"] },
  zara: { id: "zara", name: "Zara", domain: "zara.com", demoMethods: ["fedex", "ups", "store"] },
  target: { id: "target", name: "Target", domain: "target.com", demoMethods: ["ups", "store"] },
  hoka: { id: "hoka", name: "HOKA", domain: "hoka.com", demoMethods: ["ups", "fedex"] },
  sephora: { id: "sephora", name: "Sephora", domain: "sephora.com", demoMethods: ["usps", "store"] },
  aritzia: { id: "aritzia", name: "Aritzia", domain: "aritzia.com", demoMethods: ["fedex", "ups", "store"] },
};

const DEFAULT_METHODS: ReturnMethodId[] = ["ups", "fedex", "usps", "store"];

/** Display info for any purchase, known demo retailer or one discovered in real email. */
export function retailerOf(p: Pick<Purchase, "retailer" | "retailerName" | "retailerDomain">) {
  const known = RETAILERS[p.retailer as RetailerId];
  return {
    name: p.retailerName || known?.name || p.retailer,
    domain: p.retailerDomain ?? known?.domain ?? null,
    /** Demo config only; not verified retailer policy. */
    methods: known?.demoMethods ?? DEFAULT_METHODS,
  };
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "unknown";
}
