import { NextResponse, type NextRequest } from "next/server";
import { applyDataAction, DATA_ACTION_TYPES, type DataAction } from "@/lib/domain";
import { getRepo, persistDiff } from "@/server/repo";
import { getSession } from "@/server/session";

/** Applies the same state transition the browser applied optimistically, then saves it. */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { action } = (await req.json()) as { action: DataAction };
  if (!action || !DATA_ACTION_TYPES.has(action.type)) return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  if (action.type === "addPurchase") action.purchase = { ...action.purchase, userId: s.userId };

  const repo = getRepo();
  const before = await repo.loadData(s.userId);
  const after = applyDataAction(before, action);
  await persistDiff(repo, s.userId, before, after);
  return NextResponse.json({ data: after });
}
