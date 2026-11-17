import { NextResponse } from "next/server";
import { createHmac, randomUUID } from "node:crypto";
import { env } from "@/lib/env";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

/** Meta "Data Deletion Request Callback" (required for App Review). Deletes the user's contact records. */
export async function POST(req: Request) {
  const form = await req.formData();
  const signed = String(form.get("signed_request") ?? "");
  const [sig, payload] = signed.split(".");
  if (!sig || !payload) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const expected = createHmac("sha256", env.META_APP_SECRET).update(payload).digest("base64url");
  if (expected !== sig) return NextResponse.json({ error: "bad signature" }, { status: 401 });
  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (data.user_id) await sql`delete from contacts where external_id = ${String(data.user_id)}`;
  const code = randomUUID();
  return NextResponse.json({ url: `${env.APP_URL}/data-deletion?code=${code}`, confirmation_code: code });
}
