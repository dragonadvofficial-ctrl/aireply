"use server";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/crypto";

export async function login(prev: unknown, form: FormData) {
  try { return await doLogin(form); } catch (e: any) { if (e?.digest?.startsWith?.("NEXT_REDIRECT")) throw e; return { error: "We can’t reach the server right now. Try again in a minute.", email: String(form.get("email") ?? "") }; }
}
async function doLogin(form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const [u] = await sql<any[]>`select id, workspace_id, email, name, password_hash from users where email = ${email}`;
  if (!u || !verifyPassword(password, u.password_hash)) return { error: "That email and password don’t match. Check both and try again.", email };
  await createSession({ uid: u.id, wid: u.workspace_id, email: u.email, name: u.name });
  redirect("/app");
}

export async function signup(prev: unknown, form: FormData) {
  try { return await doSignup(form); } catch (e: any) { if (e?.digest?.startsWith?.("NEXT_REDIRECT")) throw e; return { error: "We can’t reach the server right now. Try again in a minute.", email: String(form.get("email") ?? "") }; }
}
async function doSignup(form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const brand = String(form.get("brand") ?? "").trim() || "My workspace";
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid email address.", email };
  if (password.length < 8) return { error: "Use at least 8 characters for your password.", email };
  const [exists] = await sql`select 1 from users where email = ${email}`;
  if (exists) return { error: "There’s already a workspace for this email. Log in instead.", email };

  const s = await sql.begin(async (tx: any) => {
    const [w] = await tx`insert into workspaces (name) values (${brand}) returning id`;
    await tx`insert into personas (workspace_id, name, dialect, tone) values (${w.id}, 'House voice', 'mirror', 'friendly and quick, sounds like a real person from the team')`;
    const [u] = await tx`insert into users (workspace_id, email, name, password_hash) values (${w.id}, ${email}, ${name || null}, ${hashPassword(password)}) returning id`;
    return { uid: u.id, wid: w.id };
  });
  await createSession({ ...s, email, name });
  redirect("/app/accounts");
}
