"use server";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function setBudget(form: FormData) {
  const s = await requireSession();
  const b = Math.max(0, Number(form.get("budget") ?? 0));
  await sql`update workspaces set monthly_budget_usd = ${b} where id = ${s.wid}`;
  revalidatePath("/app/usage");
}
