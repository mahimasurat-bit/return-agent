/**
 * DEMO FIXTURES
 *
 * Realistic-but-fictional purchases, emails, returns and refunds used when Gmail
 * is not connected. Order numbers, emails and deadlines here are invented for
 * the demo. Deadlines are treated as "stated in the (fictional) order email" and
 * do NOT represent any retailer's real return policy.

 */
import type {
  AgentActivity,
  EmailSource,
  Purchase,
  Refund,
  Return,
  RetailerId,
  ReturnMethodId,
} from "../types";
import { RETAILERS } from "../retailers";
import { fmtDay, money } from "../dates";

export const DEMO_USER_ID = "user_demo";

interface Seed {
  id: string;
  retailer: RetailerId;
  itemName: string;
  variant: string;
  category: Purchase["category"];
  tint: string;
  price: number;
  orderNumber: string;
  orderDate: string;
  deadline: string | null;
  status: Purchase["status"];
  /** For items past the "return" stage. */
  ret?: {
    reason: Return["reason"];
    methodId: ReturnMethodId;
    startedAt: string;
    droppedOffAt?: string;
    refundedAt?: string;
    code: string;
    tracking: string | null;
  };
  shipmentEmail?: boolean;
  markedAt?: string;
}

const SEEDS: Seed[] = [
  // ── DECIDE ────────────────────────────────────────────────
  {
    id: "p_nike_pegasus",
    retailer: "nike",
    itemName: "Pegasus 41",
    variant: "Women's 8 · Black / White",
    category: "shoes",
    tint: "#EEF0F2",
    price: 160,
    orderNumber: "NK48291",
    orderDate: "2026-09-14",
    deadline: "2026-10-09",
    status: "decide",
  },
  {
    id: "p_lulu_align_pant",
    retailer: "lululemon",
    itemName: "Align High-Rise Pant 25\"",
    variant: "Size 6 · Black",
    category: "bottoms",
    tint: "#F1EFEC",
    price: 118,
    orderNumber: "LL-7731904",
    orderDate: "2026-09-18",
    deadline: "2026-10-15",
    status: "decide",
    shipmentEmail: true,
  },
  {
    id: "p_target_throw",
    retailer: "target",
    itemName: "Textured Knit Throw Blanket",
    variant: "Cream",
    category: "home",
    tint: "#F5F0E8",
    price: 35,
    orderNumber: "912004318772",
    orderDate: "2026-09-28",
    deadline: null, // not stated in email → needs verification
    status: "decide",
  },
  // ── RETURN (marked, not started) ─────────────────────────
  {
    id: "p_lulu_align_jacket",
    retailer: "lululemon",
    itemName: "Align Jacket",
    variant: "Size 6 · Bone",
    category: "outerwear",
    tint: "#F2EEE7",
    price: 148,
    orderNumber: "LL-7730215",
    orderDate: "2026-09-12",
    deadline: "2026-10-11",
    status: "return",
    markedAt: "2026-09-30",
  },
  {
    id: "p_aritzia_top",
    retailer: "aritzia",
    itemName: "Contour Squareneck Top",
    variant: "Size S · Black",
    category: "top",
    tint: "#ECECEC",
    price: 68,
    orderNumber: "AR-55301827",
    orderDate: "2026-09-22",
    deadline: "2026-10-21",
    status: "return",
    markedAt: "2026-10-01",
  },
  {
    id: "p_sephora_cream",
    retailer: "sephora",
    itemName: "Protini Polypeptide Moisturizer",
    variant: "1.69 oz",
    category: "beauty",
    tint: "#F4ECEE",
    price: 68,
    orderNumber: "40028815321",
    orderDate: "2026-09-25",
    deadline: "2026-10-25",
    status: "return",
    markedAt: "2026-10-02",
  },
  // ── READY TO DROP OFF ────────────────────────────────────
  {
    id: "p_hoka_clifton",
    retailer: "hoka",
    itemName: "Clifton 10",
    variant: "Women's 8 · White / Blush",
    category: "shoes",
    tint: "#EEF2F4",
    price: 145,
    orderNumber: "HK-2291847",
    orderDate: "2026-09-10",
    deadline: "2026-10-16",
    status: "ready_to_drop_off",
    ret: { reason: "Too small", methodId: "ups", startedAt: "2026-10-01", code: "1Z-RA-7K2Q-HK91", tracking: null },
  },
  {
    id: "p_nordstrom_slip",
    retailer: "nordstrom",
    itemName: "Satin Slip Midi Dress",
    variant: "Size S · Champagne",
    category: "dress",
    tint: "#F6EFE6",
    price: 131,
    orderNumber: "NS-830144271",
    orderDate: "2026-09-16",
    deadline: "2026-10-14",
    status: "ready_to_drop_off",
    ret: { reason: "Didn't like it", methodId: "ups", startedAt: "2026-10-02", code: "1Z-RA-3M8P-NS44", tracking: null },
  },
  {
    id: "p_zara_jacket",
    retailer: "zara",
    itemName: "Wool Blend Oversized Jacket",
    variant: "Size M · Camel",
    category: "outerwear",
    tint: "#F0EAE1",
    price: 129,
    orderNumber: "52178830941",
    orderDate: "2026-09-20",
    deadline: "2026-10-20",
    status: "ready_to_drop_off",
    ret: { reason: "Too large", methodId: "fedex", startedAt: "2026-10-03", code: "FX-RA-ZR-0941", tracking: "7749 2018 5530" },
  },
  // ── DROPPED OFF ──────────────────────────────────────────
  {
    id: "p_nike_vomero",
    retailer: "nike",
    itemName: "Vomero 18",
    variant: "Women's 8 · Grey",
    category: "shoes",
    tint: "#EDEEF0",
    price: 150,
    orderNumber: "NK47120",
    orderDate: "2026-09-02",
    deadline: "2026-10-02",
    status: "dropped_off",
    ret: {
      reason: "Quality issue",
      methodId: "ups",
      startedAt: "2026-09-21",
      droppedOffAt: "2026-09-23",
      code: "1Z-RA-9T4V-NK20",
      tracking: null,
    },
  },
  // ── REFUNDED ─────────────────────────────────────────────
  {
    id: "p_nordstrom_ruched",
    retailer: "nordstrom",
    itemName: "Ruched Midi Dress",
    variant: "Size S · Navy",
    category: "dress",
    tint: "#ECEEF3",
    price: 189,
    orderNumber: "NS-829901553",
    orderDate: "2026-09-05",
    deadline: "2026-10-05",
    status: "refunded",
    ret: {
      reason: "Too large",
      methodId: "ups",
      startedAt: "2026-09-25",
      droppedOffAt: "2026-09-27",
      refundedAt: "2026-10-04",
      code: "1Z-RA-2C6N-NS53",
      tracking: null,
    },
  },
  {
    id: "p_zara_shirt",
    retailer: "zara",
    itemName: "Linen Blend Shirt",
    variant: "Size S · White",
    category: "top",
    tint: "#F3F3F1",
    price: 49.9,
    orderNumber: "52177104418",
    orderDate: "2026-09-08",
    deadline: "2026-10-08",
    status: "refunded",
    ret: {
      reason: "Changed my mind",
      methodId: "fedex",
      startedAt: "2026-09-22",
      droppedOffAt: "2026-09-24",
      refundedAt: "2026-09-30",
      code: "FX-RA-ZR-4418",
      tracking: "7749 1188 0263",
    },
  },
];

function longDate(day: string) {
  const d = new Date(day + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function addDays(day: string, n: number) {
  const d = new Date(day + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function senderFor(r: RetailerId) {
  const info = RETAILERS[r];
  return { fromName: info.name, fromAddress: `orders@${info.domain}` };
}

export interface DemoDataset {
  purchases: Purchase[];
  emails: EmailSource[];
  returns: Return[];
  refunds: Refund[];
  activities: AgentActivity[];
  /** Ordered discovery log shown on the "Finding your purchases" screen. */
  discoveryLog: string[];
}

export function buildDemoDataset(discoveredAt: string): DemoDataset {
  const purchases: Purchase[] = [];
  const emails: EmailSource[] = [];
  const returns: Return[] = [];
  const refunds: Refund[] = [];
  const activities: AgentActivity[] = [];
  let actN = 0;
  const act = (a: Omit<AgentActivity, "id">) => activities.push({ ...a, id: `act_${++actN}` });

  for (const s of SEEDS) {
    const info = RETAILERS[s.retailer];
    const sender = senderFor(s.retailer);
    const orderEmailId = `em_${s.id}_order`;

    const body = [
      `Hi Mahima,`,
      `Thanks for your order. Here's your receipt.`,
      ``,
      `Order number: ${s.orderNumber}`,
      `Order date: ${longDate(s.orderDate)}`,
      ``,
      `${s.itemName}`,
      `${s.variant}`,
      `Qty 1 · ${money(s.price)}`,
      ``,
      `Subtotal: ${money(s.price)}`,
    ];
    if (s.deadline) body.push(``, `Free returns until ${longDate(s.deadline)}.`);
    else body.push(``, `See our return policy for details.`);
    body.push(``, `View your order at ${info.domain}`);

    emails.push({
      id: orderEmailId,
      userId: DEMO_USER_ID,
      provider: "demo",
      externalMessageId: null,
      kind: "order_confirmation",
      orderNumber: s.orderNumber,
      ...sender,
      subject:
        s.retailer === "target"
          ? `Thanks for your order! #${s.orderNumber}`
          : `Your ${info.name} order ${s.orderNumber} is confirmed`,
      receivedAt: s.orderDate + "T09:12:00",
      bodyLines: body,
    });

    if (s.shipmentEmail) {
      emails.push({
        id: `em_${s.id}_ship`,
        userId: DEMO_USER_ID,
        provider: "demo",
        externalMessageId: null,
        kind: "shipping_confirmation",
        orderNumber: s.orderNumber,
        ...sender,
        subject: `Your ${info.name} order has shipped`,
        receivedAt: addDays(s.orderDate, 2) + "T15:40:00",
        bodyLines: [`Good news, your order ${s.orderNumber} is on the way.`, `${s.itemName} · ${s.variant}`],
      });
    }

    purchases.push({
      id: s.id,
      userId: DEMO_USER_ID,
      retailer: s.retailer,
      retailerName: info.name,
      retailerDomain: info.domain,
      itemName: s.itemName,
      variant: s.variant,
      category: s.category,
      imageUrl: null,
      tint: s.tint,
      price: s.price,
      currency: "USD",
      orderNumber: s.orderNumber,
      orderDate: s.orderDate,
      orderUrl: `https://www.${info.domain}`,
      emailSourceId: orderEmailId,
      returnDeadline: s.deadline,
      deadlineSource: s.deadline
        ? { kind: "verified", note: "Stated in the order confirmation email" }
        : { kind: "needs_verification" },
      status: s.status,
      unverifiedFields: s.deadline ? [] : ["returnDeadline"],
      origin: "email",
      createdAt: discoveredAt,
    });

    // Discovery activity (happens "now", when the inbox is scanned)
    act({ purchaseId: s.id, type: "email_found", message: `Found ${info.name} order confirmation`, at: discoveredAt, simulated: false });
    act({ purchaseId: s.id, type: "order_extracted", message: `Extracted order #${s.orderNumber}`, at: discoveredAt, simulated: false });
    act({ purchaseId: s.id, type: "items_identified", message: `Identified ${s.itemName} · ${money(s.price)}`, at: discoveredAt, simulated: false });
    if (s.shipmentEmail)
      act({ purchaseId: s.id, type: "shipment_matched", message: `Matched ${info.name} shipment to order`, at: discoveredAt, simulated: false });
    if (s.deadline)
      act({ purchaseId: s.id, type: "deadline_found", message: `Found return deadline: ${fmtDay(s.deadline)}`, at: discoveredAt, simulated: false });
    else
      act({ purchaseId: s.id, type: "deadline_unverified", message: `Return deadline not stated in email. Flagged for verification`, at: discoveredAt, simulated: false });

    if (s.markedAt)
      act({ purchaseId: s.id, type: "return_marked", message: `Marked ${s.itemName} for return`, at: s.markedAt + "T20:05:00", simulated: false });

    if (s.ret) {
      const r = s.ret;
      const returnId = `r_${s.id}`;
      const retEmailId = `em_${s.id}_return`;
      emails.push({
        id: retEmailId,
        userId: DEMO_USER_ID,
        provider: "demo",
        externalMessageId: null,
        kind: "return_confirmation",
        orderNumber: s.orderNumber,
        ...sender,
        subject: `Your ${info.name} return is ready`,
        receivedAt: r.startedAt + "T18:22:00",
        bodyLines: [
          `We've received your return request for order ${s.orderNumber}.`,
          `${s.itemName} · ${s.variant}`,
          `Reason: ${r.reason}`,
          `Return code: ${r.code}`,
          ...(r.tracking ? [`Tracking: ${r.tracking}`] : []),
          `Your refund of ${money(s.price)} will be issued after we receive the item.`,
        ],
      });
      returns.push({
        id: returnId,
        purchaseId: s.id,
        reason: r.reason,
        reasonNote: null,
        methodId: r.methodId,
        refundAmount: s.price,
        createdAt: r.startedAt,
        droppedOffAt: r.droppedOffAt ?? null,
        artifact: {
          type: r.methodId === "fedex" || r.methodId === "usps" || r.methodId === "mail" ? "label" : "qr",
          code: r.code,
          trackingNumber: r.tracking,
        },
        simulated: false, // found in (demo) email, not generated by the agent
      });
      act({ purchaseId: s.id, type: "return_started", message: `Found ${info.name} return confirmation email`, at: discoveredAt, simulated: false });
      act({ purchaseId: s.id, type: "return_code_generated", message: `Saved return ${r.methodId === "fedex" ? "label" : "code"} ${r.code}`, at: discoveredAt, simulated: false });

      if (r.droppedOffAt) {
        act({ purchaseId: s.id, type: "dropped_off", message: `Package dropped off at ${r.methodId.toUpperCase()}`, at: r.droppedOffAt + "T12:30:00", simulated: false });
        let refundEmailId: string | null = null;
        if (r.refundedAt) {
          refundEmailId = `em_${s.id}_refund`;
          emails.push({
            id: refundEmailId,
            userId: DEMO_USER_ID,
            provider: "demo",
            externalMessageId: null,
            kind: "refund_confirmation",
            orderNumber: s.orderNumber,
            ...sender,
            subject: `Your refund has been processed`,
            receivedAt: r.refundedAt + "T08:02:00",
            bodyLines: [
              `We've processed your refund for order ${s.orderNumber}.`,
              `${s.itemName}`,
              `Refund amount: ${money(s.price)}`,
              `It may take 3–5 business days to appear on your statement.`,
            ],
          });
          act({ purchaseId: s.id, type: "refund_detected", message: `Refund detected: ${money(s.price)} from ${info.name}`, at: discoveredAt, simulated: false });
        }
        refunds.push({
          id: `rf_${s.id}`,
          purchaseId: s.id,
          returnId,
          amount: s.price,
          status: r.refundedAt ? "received" : "waiting",
          droppedOffAt: r.droppedOffAt,
          receivedAt: r.refundedAt ?? null,
          emailSourceId: refundEmailId,
          lastCheckedAt: discoveredAt,
        });
      }
    }
  }

  const discoveryLog = [
    "Found Nike order confirmation",
    "Found Nordstrom purchase",
    "Matched Lululemon shipment to order",
    "Found Zara order",
    "Found HOKA purchase",
    "Found Target order",
    "Found Sephora order",
    "Found Aritzia order",
    "Saved 3 return codes from email",
    "Detected 2 refunds",
  ];

  return { purchases, emails, returns, refunds, activities, discoveryLog };
}
