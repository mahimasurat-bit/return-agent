import { NextResponse, type NextRequest } from "next/server";
import { maybeSendDigest } from "@/server/digest";
import { getSession } from "@/server/session";

/** "Send me one now" from the app. */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const result = await maybeSendDigest(s.userId, { force: true, appUrl: req.nextUrl.origin });
  return NextResponse.json(result, { status: result.sent ? 200 : result.reason === "not_configured" ? 400 : 500 });
}
