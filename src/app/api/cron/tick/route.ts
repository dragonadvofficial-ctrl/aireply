import { env } from "@/lib/env";
import { drain, housekeeping } from "@/lib/engine/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Safety net for serverless hosting: ping every minute (cron-job.org / Vercel Cron) with ?key=<META_WEBHOOK_VERIFY_TOKEN>. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const key = u.searchParams.get("key") ?? req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!env.META_WEBHOOK_VERIFY_TOKEN || key !== env.META_WEBHOOK_VERIFY_TOKEN) return new Response("forbidden", { status: 403 });
  const ran = await drain(50_000);
  if (Math.random() < 0.02) await housekeeping();
  return Response.json({ ok: true, ran });
}
