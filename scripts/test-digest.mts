/**
 * Digest test: builds from demo data, checks quiet-day and cadence rules, and
 * sends through a mocked Resend API. Run: npm run test:digest
 */
import assert from "node:assert/strict";
import { rmSync } from "node:fs";

process.env.APP_SECRET ||= "test-secret-test-secret-test-secret-123";
process.env.RESEND_API_KEY = "re_test";
process.env.DIGEST_EVERY_DAYS = "2";
process.env.APP_URL = "https://return-agent.example";
rmSync(process.env.LOCAL_DATA_FILE!, { force: true });

const { buildDigest, digestDue } = await import("../src/lib/digest");
const { buildDemoDataset } = await import("../src/lib/fixtures/demo-data");
const { setDemoClock } = await import("../src/lib/dates");
const { EMPTY_DATA } = await import("../src/lib/domain");
const { getRepo, persistDiff } = await import("../src/server/repo");
const { maybeSendDigest } = await import("../src/server/digest");

setDemoClock(true);
const demo = buildDemoDataset(new Date().toISOString());
const d = buildDigest(demo, { appUrl: "https://x.test", since: null, everyDays: 2 });
console.log("subject:", d.subject, "| urgent:", d.urgent);
assert.equal(d.shouldSend, true);
assert.match(d.subject, /2 returns due soon · \$308 at risk/);
assert.match(d.html, /Pegasus 41/);
assert.match(d.html, /UPS Store/);
assert.match(d.text, /REFUNDS TO CHASE/);

// Quiet day: nothing due, nothing new, nothing overdue → no email
const quiet = buildDigest(EMPTY_DATA, { appUrl: "", since: null, everyDays: 2 });
assert.equal(quiet.shouldSend, false);

// Cadence
const now = new Date("2026-10-05T13:00:00Z");
assert.equal(digestDue(null, 2, false, now), true);
assert.equal(digestDue("2026-10-04T13:00:00Z", 2, false, now), false, "1 day after: wait");
assert.equal(digestDue("2026-10-03T13:05:00Z", 2, false, now), true, "2 days after: send");
assert.equal(digestDue("2026-10-04T13:00:00Z", 2, true, now), true, "urgent: send next day");
assert.equal(digestDue("2026-10-05T08:00:00Z", 2, true, now), false, "urgent: not twice a day");

// Send through mocked Resend
const repo = getRepo();
const user = "me@example.com";
await repo.saveInbox({ userId: user, email: user, refreshTokenEnc: "x", lastSyncedAt: null, needsReauth: false, createdAt: new Date().toISOString(), skippedIds: [] });
await persistDiff(repo, user, EMPTY_DATA, demo);
const calls: { url: string; body: Record<string, unknown> }[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: string, init: RequestInit) => {
  calls.push({ url, body: JSON.parse(String(init.body)) });
  return new Response(JSON.stringify({ id: "msg_1" }), { status: 200 });
}) as typeof fetch;

const r1 = await maybeSendDigest(user);
assert.equal(r1.sent, true);
assert.equal(calls[0].url, "https://api.resend.com/emails");
assert.deepEqual(calls[0].body.to, [user]);
assert.match(String(calls[0].body.html), /Open Return Agent/);
const r2 = await maybeSendDigest(user);
assert.equal(r2.sent, false, "not again right away");
const r3 = await maybeSendDigest(user, { force: true });
assert.equal(r3.sent, true, "Send me one now always sends");
globalThis.fetch = realFetch;

console.log("All digest checks passed.");
