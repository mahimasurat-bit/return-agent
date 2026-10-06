/**
 * Applies one extracted email to the user's data. Pure (no I/O) so it can be
 * tested directly. Every created record links back to its source email.
 */
import { createHash } from "node:crypto";
import type { DataState } from "@/lib/domain";
import { makeActivity } from "@/lib/domain";
import { RETAILERS, RETURN_METHODS, slugify } from "@/lib/retailers";
import { fmtDay } from "@/lib/dates";
import type { AgentActivity, EmailSource, Purchase, Refund, Return } from "@/lib/types";
import type { Extraction } from "./extract";
import type { ParsedEmail } from "./gmail-parse";

const TINTS = ["#EEF0F2", "#F1EFEC", "#F5F0E8", "#F2EEE7", "#ECECEC", "#F4ECEE", "#EEF2F4", "#F6EFE6", "#F0EAE1", "#ECEEF3"];

const h = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);
const normOrder = (s: string | null) => (s ? s.toLowerCase().replace(/[^a-z0-9]/g, "") : "");
const normName = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const money = (n: number | null) => (n === null ? "" : ` · $${n.toFixed(2).replace(/\.00$/, "")}`);

export function resolveRetailer(ex: Extraction, email: ParsedEmail) {
  const name = ex.retailerName || email.fromName || "Unknown retailer";
  const domain = ex.retailerDomain || email.fromAddress.split("@")[1]?.split(".").slice(-2).join(".") || null;
  const known = Object.values(RETAILERS).find(
    (r) => r.name.toLowerCase() === name.toLowerCase() || (domain && domain.endsWith(r.domain)),
  );
  return {
    slug: known?.id ?? slugify(name),
    name: known?.name ?? name,
    domain: known?.domain ?? domain,
  };
}

function itemsMatch(a: string, b: string) {
  const x = normName(a);
  const y = normName(b);
  return !!x && !!y && (x.includes(y) || y.includes(x));
}

export interface ApplyResult {
  data: DataState;
  log: string[];
  createdPurchases: number;
}

export function applyExtraction(input: DataState, email: ParsedEmail, ex: Extraction, userId: string, nowIso: string): ApplyResult {
  const data: DataState = {
    purchases: [...input.purchases],
    emails: [...input.emails],
    returns: [...input.returns],
    refunds: [...input.refunds],
    activities: [...input.activities],
  };
  const log: string[] = [];
  let createdPurchases = 0;
  if (ex.kind === "not_shopping") return { data, log, createdPurchases };

  const retailer = resolveRetailer(ex, email);
  const emailId = `gm_${email.messageId}`;
  const emailDay = email.receivedAt.slice(0, 10);

  const source: EmailSource = {
    id: emailId,
    userId,
    provider: "gmail",
    externalMessageId: email.messageId,
    kind: ex.kind,
    orderNumber: ex.orderNumber,
    fromName: email.fromName,
    fromAddress: email.fromAddress,
    subject: email.subject,
    receivedAt: email.receivedAt,
    bodyLines: email.text.split("\n").slice(0, 160),
  };
  if (!data.emails.some((e) => e.id === emailId)) data.emails.push(source);

  const acts: AgentActivity[] = [];
  const act = (a: Omit<AgentActivity, "id" | "at" | "simulated">) => acts.push(makeActivity({ ...a, at: nowIso, simulated: false }));

  const sameOrder = (p: Purchase) =>
    !!ex.orderNumber && normOrder(p.orderNumber) === normOrder(ex.orderNumber) && p.retailer === retailer.slug;

  /** Purchases this email refers to: same order, narrowed by item names when given. */
  const targets = (): Purchase[] => {
    let ps = data.purchases.filter(sameOrder);
    if (!ps.length && ex.items.length) {
      ps = data.purchases.filter((p) => p.retailer === retailer.slug && ex.items.some((i) => itemsMatch(i.name, p.itemName)));
    }
    if (ps.length > 1 && ex.items.length) {
      const narrowed = ps.filter((p) => ex.items.some((i) => itemsMatch(i.name, p.itemName)));
      if (narrowed.length) ps = narrowed;
    }
    return ps;
  };

  const createPurchases = (fromKind: "order" | "shipping") => {
    ex.items.forEach((item, idx) => {
      const id = `p_${h(`${userId}|${retailer.slug}|${normOrder(ex.orderNumber) || emailId}|${normName(item.name)}|${idx}`)}`;
      if (data.purchases.some((p) => p.id === id)) return;
      if (ex.orderNumber && data.purchases.some((p) => sameOrder(p) && itemsMatch(p.itemName, item.name))) return;
      const orderDate = ex.orderDate ?? (fromKind === "order" ? emailDay : null);
      const unverified: (keyof Purchase)[] = [];
      if (item.price === null) unverified.push("price");
      if (!ex.returnDeadline) unverified.push("returnDeadline");
      if (!ex.orderNumber) unverified.push("orderNumber");
      if (!orderDate) unverified.push("orderDate");
      const variant = [item.variant, item.quantity > 1 ? `Qty ${item.quantity}` : null].filter(Boolean).join(" · ") || null;
      data.purchases.push({
        id,
        userId,
        retailer: retailer.slug,
        retailerName: retailer.name,
        retailerDomain: retailer.domain,
        itemName: item.name,
        variant,
        category: item.category,
        imageUrl: item.imageUrl,
        tint: TINTS[parseInt(id.slice(2, 6), 16) % TINTS.length],
        price: item.price,
        currency: "USD",
        orderNumber: ex.orderNumber,
        orderDate,
        orderUrl: ex.orderUrl ?? (retailer.domain ? `https://www.${retailer.domain}` : null),
        emailSourceId: emailId,
        returnDeadline: ex.returnDeadline,
        deadlineSource: ex.returnDeadline
          ? { kind: "verified", note: `Stated in the email: “${ex.returnDeadlineQuote}”` }
          : { kind: "needs_verification" },
        status: "decide",
        unverifiedFields: unverified,
        origin: "email",
        createdAt: nowIso,
      });
      createdPurchases++;
      act({ purchaseId: id, type: "items_identified", message: `Identified ${item.name}${money(item.price)}` });
      act({
        purchaseId: id,
        type: ex.returnDeadline ? "deadline_found" : "deadline_unverified",
        message: ex.returnDeadline
          ? `Found return deadline in email: ${fmtDay(ex.returnDeadline)}`
          : "Return deadline not stated in email. Flagged for verification",
      });
    });
  };

  switch (ex.kind) {
    case "order_confirmation": {
      act({ purchaseId: null, type: "email_found", message: `Found ${retailer.name} order confirmation` });
      if (ex.orderNumber) act({ purchaseId: null, type: "order_extracted", message: `Extracted order #${ex.orderNumber}` });
      createPurchases("order");
      log.push(
        ex.items.length
          ? `Found ${retailer.name} order${ex.items.length > 1 ? ` · ${ex.items.length} items` : ""}`
          : `Found ${retailer.name} order (no item details in email)`,
      );
      break;
    }
    case "shipping_confirmation":
    case "delivery_notification": {
      const ps = targets();
      const verb = ex.kind === "shipping_confirmation" ? "shipment" : "delivery";
      if (ps.length) {
        for (const p of ps) act({ purchaseId: p.id, type: "shipment_matched", message: `Matched ${retailer.name} ${verb} to order` });
        log.push(`Matched ${retailer.name} ${verb} to order`);
      } else if (ex.items.length && ex.orderNumber) {
        act({ purchaseId: null, type: "email_found", message: `Found ${retailer.name} ${verb} for an order not seen yet` });
        createPurchases("shipping");
        log.push(`Found ${retailer.name} purchase from ${verb} email`);
      } else {
        log.push(`Found ${retailer.name} ${verb} update`);
      }
      break;
    }
    case "return_confirmation": {
      const ps = targets().filter((p) => ["decide", "keep", "return", "return_started", "ready_to_drop_off"].includes(p.status));
      if (!ps.length) {
        act({ purchaseId: null, type: "email_found", message: `Found ${retailer.name} return email. Couldn't match it to a purchase` });
        log.push(`Found ${retailer.name} return email (unmatched)`);
        break;
      }
      const methodId = ex.returnMethod ?? "other";
      for (const p of ps) {
        const existing = data.returns.find((r) => r.purchaseId === p.id);
        const ret: Return = {
          id: existing?.id ?? `r_${p.id}`,
          purchaseId: p.id,
          reason: existing?.reason ?? "Other",
          reasonNote: existing?.reasonNote ?? "Started on the retailer's site",
          methodId: ex.returnMethod ?? existing?.methodId ?? methodId,
          refundAmount: existing?.refundAmount ?? p.price,
          createdAt: existing?.createdAt ?? email.receivedAt,
          droppedOffAt: existing?.droppedOffAt ?? null,
          artifact: ex.returnCode
            ? {
                type: RETURN_METHODS[methodId].artifact,
                code: ex.returnCode,
                trackingNumber: ex.trackingNumber,
                imageUrl: ex.returnCodeImageUrl,
              }
            : (existing?.artifact ?? null),
          emailSourceId: emailId,
          simulated: false,
        };
        data.returns = [...data.returns.filter((r) => r.purchaseId !== p.id), ret];
        const i = data.purchases.findIndex((x) => x.id === p.id);
        data.purchases[i] = { ...p, status: "ready_to_drop_off" };
        act({ purchaseId: p.id, type: "return_started", message: `Found ${retailer.name} return confirmation for ${p.itemName}` });
        if (ex.returnCode) act({ purchaseId: p.id, type: "return_code_generated", message: `Saved return code ${ex.returnCode} from email` });
      }
      log.push(ex.returnCode ? `Saved ${retailer.name} return code` : `Found ${retailer.name} return`);
      break;
    }
    case "refund_confirmation": {
      const ps = targets().filter((p) => p.status !== "refunded");
      if (!ps.length) {
        act({ purchaseId: null, type: "email_found", message: `Found ${retailer.name} refund email. Couldn't match it to a purchase` });
        log.push(`Found ${retailer.name} refund (unmatched)`);
        break;
      }
      for (const p of ps) {
        const amount = ps.length === 1 ? (ex.refundAmount ?? p.price) : p.price;
        const ret = data.returns.find((r) => r.purchaseId === p.id);
        const existing = data.refunds.find((r) => r.purchaseId === p.id);
        const refund: Refund = {
          id: existing?.id ?? `rf_${p.id}`,
          purchaseId: p.id,
          returnId: existing?.returnId ?? ret?.id ?? "",
          amount,
          status: "received",
          droppedOffAt: existing?.droppedOffAt ?? ret?.droppedOffAt ?? null,
          receivedAt: emailDay,
          emailSourceId: emailId,
          lastCheckedAt: nowIso,
        };
        data.refunds = [...data.refunds.filter((r) => r.purchaseId !== p.id), refund];
        const i = data.purchases.findIndex((x) => x.id === p.id);
        data.purchases[i] = { ...p, status: "refunded" };
        act({ purchaseId: p.id, type: "refund_detected", message: `Refund detected: ${p.itemName}${money(amount)}` });
      }
      log.push(`Detected ${retailer.name} refund`);
      break;
    }
  }

  // Attach purchase ids to email-level activities created before purchases existed.
  const firstPurchase = data.purchases.find((p) => p.emailSourceId === emailId);
  data.activities = [
    ...acts.map((a) => (a.purchaseId === null && firstPurchase ? { ...a, purchaseId: firstPurchase.id } : a)),
    ...data.activities,
  ];
  return { data, log, createdPurchases };
}

