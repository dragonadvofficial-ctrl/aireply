"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { bumpBrain } from "@/lib/ai/context";

export async function savePersona(form: FormData) {
  const s = await requireSession();
  const id = String(form.get("id") ?? "");
  const examples = String(form.get("examples") ?? "").split("\n").map((l) => l.split(/\s*(?:=>|←|->)\s*/)).filter((p) => p.length >= 2 && p[0] && p[1])
    .map(([a, ...b]) => ({ in: a.trim(), out: b.join(" ").trim() })).slice(0, 12);
  const v = {
    name: String(form.get("name") ?? "").trim() || "Untitled voice",
    dialect: String(form.get("dialect") ?? "mirror"),
    formality: Number(form.get("formality") ?? 35),
    emoji_level: Number(form.get("emoji_level") ?? 1),
    max_chars: Math.min(1000, Math.max(60, Number(form.get("max_chars") ?? 280))),
    tone: String(form.get("tone") ?? ""), rules: String(form.get("rules") ?? ""), cta: String(form.get("cta") ?? ""),
  };
  let pid = id;
  if (id) {
    await sql`update personas set name = ${v.name}, dialect = ${v.dialect}, formality = ${v.formality}, emoji_level = ${v.emoji_level},
      max_chars = ${v.max_chars}, tone = ${v.tone}, rules = ${v.rules}, cta = ${v.cta}, examples = ${sql.json(examples)},
      version = version + 1, updated_at = now() where id = ${id} and workspace_id = ${s.wid}`;
  } else {
    [{ id: pid }] = await sql`insert into personas (workspace_id, name, dialect, formality, emoji_level, max_chars, tone, rules, cta, examples)
      values (${s.wid}, ${v.name}, ${v.dialect}, ${v.formality}, ${v.emoji_level}, ${v.max_chars}, ${v.tone}, ${v.rules}, ${v.cta}, ${sql.json(examples)}) returning id`;
  }
  await bumpBrain(s.wid);
  revalidatePath("/app/voice");
  redirect(`/app/voice?p=${pid}&t=Saved`);
}

export async function deletePersona(form: FormData) {
  const s = await requireSession();
  await sql`delete from personas where id = ${String(form.get("id"))} and workspace_id = ${s.wid}`;
  await bumpBrain(s.wid);
  revalidatePath("/app/voice");
  redirect("/app/voice?t=Deleted");
}
