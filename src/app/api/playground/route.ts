import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { loadContext } from "@/lib/ai/context";
import { decide } from "@/lib/ai/pipeline";

export const runtime = "nodejs";

/** Dry run: same ladder as production, nothing is posted to Meta. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { accountId, channel, text, history } = await req.json();
  const [a] = await sql`select id from accounts where id = ${accountId} and workspace_id = ${s.wid}`;
  if (!a) return NextResponse.json({ error: "account not found" }, { status: 404 });
  try {
    const ctx = await loadContext(accountId);
    const d = await decide({ ctx, channel: channel === "dm" ? "dm" : "comment", text: String(text).slice(0, 2000), history: history ?? [], isFirstTurn: !(history?.length) });
    return NextResponse.json(d);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
