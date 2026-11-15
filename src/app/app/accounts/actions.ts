"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { bumpBrain } from "@/lib/ai/context";

const lines = (v: FormDataEntryValue | null) => String(v ?? "").split("\n").map((l) => l.trim()).filter(Boolean);

export async function updateAccount(form: FormData) {
  const s = await requireSession();
  const id = String(form.get("id"));
  const lo = Math.max(0, Number(form.get("delay_lo") ?? 4)), hi = Math.max(lo, Number(form.get("delay_hi") ?? 15));
  const settings = {
    comments: form.get("comments") === "on",
    dms: form.get("dms") === "on",
    hide_spam: form.get("hide_spam") === "on",
    noise: form.get("noise_thanks") === "on" ? "thanks" : "ignore",
    comment_strategy: String(form.get("comment_strategy") ?? "smart"),
    public_ack: lines(form.get("public_ack")),
    reply_delay_sec: [lo, hi],
    smart_model: form.get("smart_model") === "on",
  };
  const squad = String(form.get("squad_id") ?? "") || null;
  const persona = String(form.get("persona_id") ?? "") || null;
  await sql`
    update accounts set squad_id = ${squad}, persona_id = ${persona}, reply_mode = ${String(form.get("reply_mode"))},
      status = ${form.get("paused") === "on" ? "paused" : "active"}, settings = ${sql.json(settings)}
    where id = ${id} and workspace_id = ${s.wid} and status <> 'disconnected'`;
  await bumpBrain(s.wid);
  revalidatePath("/app/accounts");
  redirect(`/app/accounts?a=${id}&t=Saved`);
}

export async function disconnectAccount(form: FormData) {
  const s = await requireSession();
  const id = String(form.get("id"));
  await sql`update accounts set status = 'disconnected', access_token_enc = null where id = ${id} and workspace_id = ${s.wid}`;
  revalidatePath("/app/accounts");
  redirect(`/app/accounts?t=Disconnected`);
}
