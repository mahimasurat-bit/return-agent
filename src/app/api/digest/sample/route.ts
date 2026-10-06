import { NextResponse, type NextRequest } from "next/server";
import { buildDigest } from "@/lib/digest";
import { setDemoClock } from "@/lib/dates";
import { buildDemoDataset } from "@/lib/fixtures/demo-data";
import { env } from "@/server/env";

/**
 * Sends the DEMO digest to DIGEST_TO so the owner can see a real email without
 * connecting Gmail. Only ever sends to that one fixed address.
 */
let lastSent = 0;

export async function POST(req: NextRequest) {
  if (!env.resendKey || !env.digestTo) {
    return NextResponse.json({ sent: false, reason: "not_configured" }, { status: 400 });
  }
  if (Date.now() - lastSent < 60_000) {
    return NextResponse.json({ sent: false, reason: "cooldown", detail: "One sample a minute. Try again shortly." }, { status: 429 });
  }

  // Build synchronously with the demo clock pinned so fixture deadlines read correctly.
  let d;
  setDemoClock(true);
  try {
    d = buildDigest(buildDemoDataset(new Date().toISOString()), {
      appUrl: env.appUrl || req.nextUrl.origin,
      since: null,
      everyDays: env.digestEveryDays,
    });
  } finally {
    setDemoClock(false);
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.resendKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: env.digestFrom,
      to: [env.digestTo],
      subject: `[Sample] Return Agent: ${d.subject}`,
      html: d.html,
      text: d.text,
    }),
  });
  if (!res.ok) {
    return NextResponse.json({ sent: false, reason: "error", detail: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}` }, { status: 502 });
  }
  lastSent = Date.now();
  return NextResponse.json({ sent: true });
}
