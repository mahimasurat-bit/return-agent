import { NextResponse } from "next/server";
import { getRepo } from "@/server/repo";
import { getSession } from "@/server/session";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json({ data: await getRepo().loadData(s.userId) });
}
