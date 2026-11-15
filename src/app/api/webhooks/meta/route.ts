import { NextResponse, after } from "next/server";
import { env } from "@/lib/env";
import { sql } from "@/lib/db";
import { normalize, verifySignature } from "@/lib/meta/webhook";
import { ingest } from "@/lib/engine/ingest";
import { drain } from "@/lib/engine/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Meta verification handshake (App Dashboard → Webhooks → Verify and save). */
export async function GET(req: Request) {
  const u = new URL(req.url);
  if (u.searchParams.get("hub.mode") === "subscribe" && env.META_WEBHOOK_VERIFY_TOKEN && u.searchParams.get("hub.verify_token") === env.META_WEBHOOK_VERIFY_TOKEN) {
    return new Response(u.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

/** One endpoint for every Page + IG account. Verify → store → normalize → enqueue → 200 (fast). */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) {
    return new Response("bad signature", { status: 401 });
  }
  let body: any;
  try { body = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }

  const [row] = await sql<{ id: number }[]>`insert into webhook_events (object, payload) values (${body.object ?? null}, ${sql.json(body)}) returning id`;
  try {
    const queued = await ingest(normalize(body));
    // serverless hosts: finish the reply after answering Meta (set INLINE_WORKER=false when a real worker runs)
    if (queued && process.env.INLINE_WORKER !== "false") after(() => drain(50_000).catch((e) => console.error("drain", e?.message)));
    await sql`update webhook_events set processed_at = now() where id = ${row.id}`;
    return NextResponse.json({ ok: true, queued });
  } catch (e: any) {
    await sql`update webhook_events set error = ${String(e?.message ?? e)} where id = ${row.id}`;
    return NextResponse.json({ ok: false }, { status: 200 }); // stored raw; don't make Meta retry-storm us
  }
}
