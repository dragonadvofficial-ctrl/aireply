import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { env } from "@/lib/env";
import { hashPassword, verifyPassword } from "@/lib/crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`timeout ${ms}ms`)), ms))]);

/** Temporary diagnostic: times each step the login/signup flow uses. Protected by the webhook verify token. */
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("key") !== env.META_WEBHOOK_VERIFY_TOKEN) return new NextResponse("no", { status: 401 });
  const out: Record<string, string> = {};
  const step = async (name: string, fn: () => Promise<unknown>) => {
    const t = Date.now();
    try { await withTimeout(fn(), 10_000); out[name] = `ok ${Date.now() - t}ms`; }
    catch (e: any) { out[name] = `FAIL ${Date.now() - t}ms ${String(e?.message ?? e).slice(0, 160)}`; }
  };
  out.pool_max = String(env.DB_POOL_MAX);
  out.prepare = String(env.DB_PREPARE);
  await step("select_1", () => sql`select 1`);
  await step("count_users", () => sql`select count(*)::int n from users`);
  await step("users_by_email", () => sql`select id, workspace_id, password_hash from users limit 1`);
  await step("scrypt", async () => { verifyPassword("x", hashPassword("x")); });
  await step("needs_you", () => sql`select count(*)::int n from conversations c join accounts a on a.id = c.account_id where c.status = 'human'`);
  await step("accounts_query", () => sql`select a.id, (select count(*)::int from messages m where m.account_id = a.id) as n from accounts a limit 5`);
  await step("tx_begin", () => sql.begin(async (tx: any) => { await tx`select 1`; }));
  await step("parallel_4", () => Promise.all([sql`select 1`, sql`select 2`, sql`select 3`, sql`select 4`]));
  return NextResponse.json(out);
}
