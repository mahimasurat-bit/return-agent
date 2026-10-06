/**
 * Return Agent domain model.
 *
 * These types mirror the Supabase schema in `supabase/schema.sql` so the
 * in-memory demo store can be swapped for a real database without touching UI.
 */

export type ISODate = string; // "2026-10-05" or full ISO timestamp

export interface User {
  id: string;
  name: string;
  email: string;
  gmailConnected: boolean;
  /** Future: multiple household inboxes. Not implemented in V1. */
  connectedInboxes: string[];
}

export type EmailKind =
  | "order_confirmation"
  | "shipping_confirmation"
  | "delivery_notification"
  | "return_confirmation"
  | "refund_confirmation";

/** A single email the agent read. Every purchase points back to one of these. */
export interface EmailSource {
  id: string;
  userId: string;
  provider: "gmail" | "demo";
  /** Gmail message id once real ingestion is wired up. */
  externalMessageId: string | null;
  kind: EmailKind;
  /** Which connected inbox this came from, when more than one is connected (e.g. "Household inbox"). */
  inboxLabel?: string | null;
  /** Order number the agent extracted from this email, used to link emails to purchases. */
  orderNumber: string | null;
  fromName: string;
  fromAddress: string;
  subject: string;
  receivedAt: ISODate;
  /** Plain-text body (or a trimmed excerpt). Extracted values are highlighted in the UI. */
  bodyLines: string[];
}

export type RetailerId =
  | "nike"
  | "lululemon"
  | "nordstrom"
  | "zara"
  | "target"
  | "hoka"
  | "sephora"
  | "aritzia"
  | "amazon";

/** "other" = method not stated in the return email; user checks the email. */
export type ReturnMethodId = "ups" | "fedex" | "usps" | "store" | "mail" | "other";

export interface ReturnMethod {
  id: ReturnMethodId;
  label: string; // "UPS Store"
  shortLabel: string; // "UPS"
  /** What the user brings: a QR code to scan, a printed label, or nothing (in-store). */
  artifact: "qr" | "label" | "none";
  instructions: string;
}

export type PurchaseStatus =
  | "decide" // agent found it; user hasn't decided
  | "keep"
  | "return" // user intends to return; return not started
  | "return_started" // return flow in progress
  | "ready_to_drop_off" // return code / label in hand
  | "dropped_off" // waiting on refund
  | "refunded";

export type ProductCategory =
  | "shoes"
  | "top"
  | "bottoms"
  | "dress"
  | "outerwear"
  | "beauty"
  | "home"
  | "tech";

/** How the agent knows the return deadline. Never invented. */
export type DeadlineSource =
  | { kind: "verified"; note: string } // e.g. stated in the order email, or a verified policy
  | { kind: "needs_verification" };

export interface Purchase {
  id: string;
  userId: string;
  /** Slug, e.g. "nike". Known retailers match RetailerId; real email can produce any retailer. */
  retailer: string;
  retailerName: string;
  retailerDomain: string | null;
  /** Which connected inbox the purchase was found in, when more than one is connected. */
  inboxLabel?: string | null;
  itemName: string;
  variant: string | null; // "Size 9 · Black"
  category: ProductCategory;
  /** Product image from the email, if one could be extracted. null → category illustration. */
  imageUrl: string | null;
  /** Visual tint for the placeholder tile. */
  tint: string;
  price: number | null;
  currency: "USD";
  orderNumber: string | null;
  orderDate: ISODate | null;
  orderUrl: string | null;
  emailSourceId: string | null; // null only for manual entries
  returnDeadline: ISODate | null;
  deadlineSource: DeadlineSource;
  status: PurchaseStatus;
  /** Fields the extractor wasn't confident about. Shown as "Needs verification". */
  unverifiedFields: (keyof Purchase)[];
  origin: "email" | "manual";
  createdAt: ISODate;
}

export type ReturnReason =
  | "Too small"
  | "Too large"
  | "Didn't like it"
  | "Changed my mind"
  | "Quality issue"
  | "Arrived damaged"
  | "Other";

export interface ReturnArtifact {
  type: "qr" | "label" | "none";
  /** The return code (from the retailer's email, or a placeholder in demo/simulated returns). */
  code: string;
  trackingNumber: string | null;
  /** The retailer's own QR/barcode image from the return email, when one could be identified. */
  imageUrl?: string | null;
}

export interface Return {
  id: string;
  purchaseId: string;
  reason: ReturnReason;
  reasonNote: string | null;
  methodId: ReturnMethodId;
  refundAmount: number | null;
  createdAt: ISODate;
  droppedOffAt: ISODate | null;
  artifact: ReturnArtifact | null;
  /** The retailer's return confirmation email, when the return came from email. */
  emailSourceId?: string | null;
  /** True when the retailer interaction was simulated (always true in V1). */
  simulated: boolean;
}

export type RefundStatus = "waiting" | "received";

export interface Refund {
  id: string;
  purchaseId: string;
  returnId: string;
  amount: number | null;
  status: RefundStatus;
  droppedOffAt: ISODate | null;
  receivedAt: ISODate | null;
  /** Email that confirmed the refund, if detected. */
  emailSourceId: string | null;
  lastCheckedAt: ISODate | null;
}

export type AgentActivityType =
  | "email_found"
  | "order_extracted"
  | "items_identified"
  | "shipment_matched"
  | "deadline_found"
  | "deadline_unverified"
  | "return_marked"
  | "kept"
  | "return_started"
  | "return_code_generated"
  | "dropped_off"
  | "refund_detected"
  | "refund_checked"
  | "manual_added";

export interface AgentActivity {
  id: string;
  purchaseId: string | null;
  type: AgentActivityType;
  message: string;
  at: ISODate;
  /** True when the step was simulated rather than performed against a real system. */
  simulated: boolean;
}
