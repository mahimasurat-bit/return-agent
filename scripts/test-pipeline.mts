/**
 * Pipeline test with fake Gmail + fake model outputs (no network).
 * Run: npm run test:pipeline
 */
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { htmlToText, parseGmailMessage } from "../src/server/gmail-parse";
import { verifyExtraction } from "../src/server/extract";
import { FakeExtractor, FakeGmail, FAKE_MESSAGES } from "../src/server/fakes";
import { getRepo } from "../src/server/repo";
import { runSync } from "../src/server/sync";
import { applyDataAction } from "../src/lib/domain";

process.env.APP_SECRET ||= "test-secret-test-secret-test-secret-123";
const FILE = process.env.LOCAL_DATA_FILE!;
rmSync(FILE, { force: true });

// 1. HTML → text
const t = htmlToText(`<style>.a{}</style><p>Order&nbsp;#123</p><img src="https://x.com/p.jpg" alt="Blue Shirt" width="100"><a href="https://shop.com/orders/1">View order</a>`);
assert.match(t.text, /Order #123/);
assert.match(t.text, /View order \[https:\/\/shop\.com\/orders\/1\]/);
assert.equal(t.images[0].alt, "Blue Shirt");
assert.doesNotMatch(t.text, /\.a\{\}/);

// 2. Verification drops anything not in the email
const nord = parseGmailMessage(FAKE_MESSAGES[0]);
assert.match(nord.text, /Wrap Midi Dress/);
const v = verifyExtraction(
  {
    kind: "order_confirmation",
    retailer_name: "Nordstrom",
    order_number: "999999",
    items: [{ name: "Wrap Midi Dress", price: 150, quantity: 1, category: "dress", image_url: "https://evil.example/x.jpg" }],
    return_deadline: "2026-12-01",
    return_deadline_quote: "made up",
    refund_amount: null,
  },
  nord,
);
assert.equal(v.orderNumber, null, "invented order number rejected");
assert.equal(v.items[0].price, null, "price not in email rejected");
assert.equal(v.items[0].imageUrl, null, "image not in candidates rejected");
assert.equal(v.returnDeadline, null, "unquoted deadline rejected");

// 3. Full sync
const repo = getRepo();
const inbox = { userId: "me@example.com", email: "me@example.com", refreshTokenEnc: "x", lastSyncedAt: null, needsReauth: false, createdAt: new Date().toISOString(), skippedIds: [] };
await repo.saveInbox(inbox);
const logs: string[] = [];
const r1 = await runSync({ repo, gmail: new FakeGmail(), extractor: new FakeExtractor(), inbox, onEvent: (e) => e.type === "log" && logs.push(e.message) });
console.log("sync 1:", r1);
console.log(logs.map((l) => "  · " + l).join("\n"));

const d = await repo.loadData("me@example.com");
const byName = (n: string) => d.purchases.find((p) => p.itemName.startsWith(n))!;
assert.equal(d.purchases.length, 5, "5 purchases (2 Nordstrom, 1 lululemon, 1 Zara, 1 Target)");
assert.equal(r1.skipped, 1, "promo skipped");
assert.equal(d.emails.length, 7, "only shopping emails stored");
assert.ok(!d.emails.some((e) => e.externalMessageId === "fake_promo"), "promo not stored");

const dress = byName("Wrap Midi Dress");
assert.equal(dress.price, 149);
assert.equal(dress.returnDeadline, null, "hallucinated deadline dropped");
assert.equal(dress.deadlineSource.kind, "needs_verification");
assert.equal(dress.imageUrl, "https://n.nordstrommedia.com/id/sr3/abc.jpeg");
assert.equal(dress.status, "decide");
assert.equal(dress.retailer, "nordstrom");

const jacket = byName("Define Jacket");
assert.equal(jacket.returnDeadline, "2026-10-30", "quoted deadline kept");
assert.ok(d.activities.some((a) => a.purchaseId === jacket.id && a.type === "shipment_matched"), "shipment matched");

const cardigan = byName("Textured Knit Cardigan");
assert.equal(cardigan.status, "ready_to_drop_off");
const ret = d.returns.find((x) => x.purchaseId === cardigan.id)!;
assert.equal(ret.methodId, "ups");
assert.equal(ret.artifact?.code, "RTN-7Q4P-ZK21");
assert.equal(ret.simulated, false);

const mugs = byName("Stoneware Mug Set");
assert.equal(mugs.status, "refunded");
const rf = d.refunds.find((x) => x.purchaseId === mugs.id)!;
assert.equal(rf.amount, 24.99);
assert.equal(rf.status, "received");

// 4. Idempotent: second sync adds nothing and re-reads nothing
const inbox2 = (await repo.getInbox("me@example.com"))!;
assert.ok(inbox2.lastSyncedAt);
assert.deepEqual(inbox2.skippedIds, ["fake_promo"]);
const r2 = await runSync({ repo, gmail: new FakeGmail(), extractor: new FakeExtractor(), inbox: inbox2 });
assert.equal(r2.scanned, 0, "nothing re-read");
assert.equal((await repo.loadData("me@example.com")).purchases.length, 5);

// 5. Shared actions work on server data
const after = applyDataAction(d, { type: "droppedOff", ids: [cardigan.id] });
assert.equal(after.purchases.find((p) => p.id === cardigan.id)!.status, "dropped_off");
assert.equal(after.refunds.filter((x) => x.purchaseId === cardigan.id).length, 1);

console.log("\nAll pipeline checks passed.");
