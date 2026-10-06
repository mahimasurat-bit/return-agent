/**
 * The only Gmail searches Return Agent runs. Shown verbatim in the app
 * ("What Return Agent reads") so the user can see exactly what is read.
 */
import type { EmailKind } from "../types";

/** Gmail's own Purchases category, plus shopping keywords outside promotions/social/forums. */
export const SHOPPING_QUERY =
  '(category:purchases OR (subject:(order OR receipt OR shipped OR "on its way" OR "on the way" OR delivered OR return OR refund OR refunded) -category:promotions -category:social -category:forums))';

/** Human-readable breakdown of what the single search above is meant to find. */
export const GMAIL_QUERIES: Record<EmailKind, string> = {
  order_confirmation: "Order confirmations and receipts",
  shipping_confirmation: "Shipped / on its way",
  delivery_notification: "Delivered",
  return_confirmation: "Return started, return labels and QR codes",
  refund_confirmation: "Refund issued or processed",
};
