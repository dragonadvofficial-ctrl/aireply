import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [q] = await sql<{ queued: number; dead: number }[]>`
      select count(*) filter (where status = 'queued' and run_at < now() - interval '2 minutes')::int as queued,
             count(*) filter (where status = 'dead' and finished_at > now() - interval '1 hour')::int as dead from jobs`;
    return NextResponse.json({ ok: true, backlog: q.queued, dead_last_hour: q.dead });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 503 });
  }
}
