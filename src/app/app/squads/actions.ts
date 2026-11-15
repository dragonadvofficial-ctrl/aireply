"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { bumpBrain } from "@/lib/ai/context";

export async function saveSquad(form: FormData) {
  const s = await requireSession();
  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim() || "Untitled squad";
  const color = String(form.get("color") ?? "lime");
  const description = String(form.get("description") ?? "");
  const persona = String(form.get("persona_id") ?? "") || null;
  const members = form.getAll("members").map(String);

  const squadId = await sql.begin(async (tx: any) => {
    let sid = id;
    if (sid) {
      await tx`update squads set name = ${name}, color = ${color}, description = ${description}, persona_id = ${persona} where id = ${sid} and workspace_id = ${s.wid}`;
    } else {
      [{ id: sid }] = await tx`insert into squads (workspace_id, name, color, description, persona_id) values (${s.wid}, ${name}, ${color}, ${description}, ${persona}) returning id`;
    }
    await tx`update accounts set squad_id = null where squad_id = ${sid} and workspace_id = ${s.wid} and not (id = any(${members}::uuid[]))`;
    if (members.length) await tx`update accounts set squad_id = ${sid} where workspace_id = ${s.wid} and id = any(${members}::uuid[])`;
    return sid;
  });
  await bumpBrain(s.wid);
  revalidatePath("/app/squads");
  redirect(`/app/squads?s=${squadId}&t=Saved`);
}

export async function deleteSquad(form: FormData) {
  const s = await requireSession();
  await sql`delete from squads where id = ${String(form.get("id"))} and workspace_id = ${s.wid}`;
  await bumpBrain(s.wid);
  revalidatePath("/app/squads");
  redirect(`/app/squads?t=Deleted`);
}
