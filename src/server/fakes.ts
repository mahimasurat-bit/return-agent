/**
 * DEVELOPMENT / TEST ONLY.
 * Fake Gmail + fake extractor so the full live pipeline (sync → storage → UI)
 * can be exercised without Google or Anthropic credentials. Enabled only when
 * RA_FAKE_PROVIDERS=1 and NODE_ENV !== "production".
 */
import type { Extraction, Extractor } from "./extract";
import { verifyExtraction } from "./extract";
import type { GmailClient, GmailMessage } from "./google";
import type { ParsedEmail } from "./gmail-parse";

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const daysAgo = (n: number) => String(Date.now() - n * 86_400_000);

function msg(id: string, from: string, subject: string, html: string, ageDays: number, labels: string[] = ["CATEGORY_PURCHASES"]): GmailMessage {
  return {
    id,
    threadId: `t_${id}`,
    internalDate: daysAgo(ageDays),
    labelIds: labels,
    payload: {
      mimeType: "multipart/alternative",
      headers: [
        { name: "From", value: from },
        { name: "Subject", value: subject },
      ],
      parts: [{ mimeType: "text/html", body: { data: b64(html) } }],
    },
  };
}

export const FAKE_MESSAGES: GmailMessage[] = [
  msg(
    "fake_nord_order",
    '"Nordstrom" <nordstrom@eml.nordstrom.com>',
    "Thanks for your order! Order #833201947",
    `<html><head><style>.x{color:red}</style></head><body><table><tr><td>Hi Mahima,</td></tr>
     <tr><td>Order number: <b>833201947</b></td></tr><tr><td>Order date: September 28, 2026</td></tr>
     <tr><td><img src="https://n.nordstrommedia.com/id/sr3/abc.jpeg" alt="Wrap Midi Dress" width="120"></td>
     <td>Wrap Midi Dress<br>Size: S &nbsp;|&nbsp; Color: Black</td><td>$149.00</td></tr>
     <tr><td>Cashmere Crewneck Sweater<br>Size: M</td><td>$128.00</td></tr>
     <tr><td>Shipping</td><td>FREE</td></tr>
     <tr><td><a href="https://www.nordstrom.com/my-account/orders/833201947">View order status</a></td></tr></table></body></html>`,
    7,
  ),
  msg(
    "fake_lulu_order",
    '"lululemon" <orders@e.lululemon.com>',
    "Your lululemon order confirmation",
    `<p>Thank you for your order.</p><p>Order #C0412339871</p>
     <p>Define Jacket Nulu — Size 6, Black — $128.00</p>
     <p>You can return unworn items until October 30, 2026.</p>`,
    6,
  ),
  msg(
    "fake_lulu_ship",
    '"lululemon" <orders@e.lululemon.com>',
    "Your order is on its way",
    `<p>Good news! Order #C0412339871 has shipped.</p><p>Define Jacket Nulu</p><p>Tracking: 1Z999AA10123456784</p>`,
    4,
  ),
  msg(
    "fake_promo",
    '"Zara" <news@zara.com>',
    "New in: autumn edit. Order now!",
    `<p>Discover the new collection. Free shipping on orders over $50.</p>`,
    3,
    ["CATEGORY_PROMOTIONS"],
  ),
  msg(
    "fake_zara_order",
    '"ZARA" <noreply@zara.com>',
    "Order confirmation 61900432178",
    `<p>Thank you for shopping at ZARA.</p><p>Order no. 61900432178</p><p>TEXTURED KNIT CARDIGAN · M · Ecru · 59.90 USD</p>`,
    9,
  ),
  msg(
    "fake_zara_return",
    '"ZARA" <noreply@zara.com>',
    "Your return request 61900432178",
    `<p>We have received your return request for order 61900432178.</p><p>TEXTURED KNIT CARDIGAN</p>
     <p>Take your package to any UPS Store and show this code: RTN-7Q4P-ZK21</p>
     <img src="https://static.zara.net/returns/qr/RTN-7Q4P-ZK21.png" width="180">`,
    2,
  ),
  msg(
    "fake_target_refund",
    '"Target" <orders@oe.target.com>',
    "Your refund has been issued",
    `<p>We've issued a refund of $24.99 for order 102003998812.</p><p>Stoneware Mug Set</p>`,
    1,
  ),
  msg(
    "fake_target_order",
    '"Target" <orders@oe.target.com>',
    "Thanks for your order #102003998812",
    `<p>Order #102003998812</p><p>Stoneware Mug Set, 4pk</p><p>$24.99</p>`,
    20,
  ),
];

/** Raw "model outputs" per message, including one hallucinated deadline the verifier must reject. */
const RAW: Record<string, Record<string, unknown>> = {
  fake_nord_order: {
    kind: "order_confirmation",
    retailer_name: "Nordstrom",
    retailer_domain: "nordstrom.com",
    order_number: "833201947",
    order_date: "2026-09-28",
    order_url: "https://www.nordstrom.com/my-account/orders/833201947",
    items: [
      { name: "Wrap Midi Dress", variant: "S · Black", price: 149, quantity: 1, category: "dress", image_url: "https://n.nordstrommedia.com/id/sr3/abc.jpeg" },
      { name: "Cashmere Crewneck Sweater", variant: "M", price: 128, quantity: 1, category: "top", image_url: null },
    ],
    // Hallucinated: the email never states a deadline. Verification must drop this.
    return_deadline: "2026-11-27",
    return_deadline_quote: "Returns accepted within 60 days",
    refund_amount: null,
  },
  fake_lulu_order: {
    kind: "order_confirmation",
    retailer_name: "lululemon",
    retailer_domain: "lululemon.com",
    order_number: "C0412339871",
    order_date: null,
    items: [{ name: "Define Jacket Nulu", variant: "6 · Black", price: 128, quantity: 1, category: "outerwear", image_url: null }],
    return_deadline: "2026-10-30",
    return_deadline_quote: "You can return unworn items until October 30, 2026.",
    refund_amount: null,
  },
  fake_lulu_ship: {
    kind: "shipping_confirmation",
    retailer_name: "lululemon",
    order_number: "C0412339871",
    items: [{ name: "Define Jacket Nulu", variant: null, price: null, quantity: 1, category: "outerwear", image_url: null }],
    tracking_number: "1Z999AA10123456784",
    return_deadline: null,
    return_deadline_quote: null,
    refund_amount: null,
  },
  fake_promo: { kind: "not_shopping", retailer_name: null, order_number: null, items: [], return_deadline: null, return_deadline_quote: null, refund_amount: null },
  fake_zara_order: {
    kind: "order_confirmation",
    retailer_name: "Zara",
    order_number: "61900432178",
    items: [{ name: "Textured Knit Cardigan", variant: "M · Ecru", price: 59.9, quantity: 1, category: "top", image_url: null }],
    return_deadline: null,
    return_deadline_quote: null,
    refund_amount: null,
  },
  fake_zara_return: {
    kind: "return_confirmation",
    retailer_name: "Zara",
    order_number: "61900432178",
    items: [{ name: "Textured Knit Cardigan", variant: null, price: null, quantity: 1, category: "top", image_url: null }],
    return_method: "ups",
    return_code: "RTN-7Q4P-ZK21",
    return_code_image_url: "https://static.zara.net/returns/qr/RTN-7Q4P-ZK21.png",
    return_deadline: null,
    return_deadline_quote: null,
    refund_amount: null,
  },
  fake_target_refund: {
    kind: "refund_confirmation",
    retailer_name: "Target",
    order_number: "102003998812",
    items: [{ name: "Stoneware Mug Set", variant: null, price: null, quantity: 1, category: "home", image_url: null }],
    return_deadline: null,
    return_deadline_quote: null,
    refund_amount: 24.99,
  },
  fake_target_order: {
    kind: "order_confirmation",
    retailer_name: "Target",
    order_number: "102003998812",
    items: [{ name: "Stoneware Mug Set, 4pk", variant: null, price: 24.99, quantity: 1, category: "home", image_url: null }],
    return_deadline: null,
    return_deadline_quote: null,
    refund_amount: null,
  },
};

export class FakeGmail implements GmailClient {
  constructor(private messages: GmailMessage[] = FAKE_MESSAGES) {}
  async search() {
    // Newest first, like Gmail.
    return [...this.messages].sort((a, b) => Number(b.internalDate) - Number(a.internalDate)).map((m) => ({ id: m.id }));
  }
  async get(id: string) {
    const m = this.messages.find((x) => x.id === id);
    if (!m) throw new Error(`no message ${id}`);
    return m;
  }
}

export class FakeExtractor implements Extractor {
  async extract(email: ParsedEmail): Promise<Extraction> {
    await new Promise((r) => setTimeout(r, 120));
    return verifyExtraction(RAW[email.messageId] ?? { kind: "not_shopping", items: [] }, email);
  }
}
