import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { facebookExchange, listPages, subscribePage } from "@/lib/meta/oauth";

export const runtime = "nodejs";

/** Imports every Page (and its linked IG professional account) the user granted, then subscribes webhooks. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const st = await verifyToken<{ wid: string }>(u.searchParams.get("state") ?? "");
  if (!st) return new Response("invalid state", { status: 400 });
  const code = u.searchParams.get("code");
  if (!code) redirect(`/app/accounts?error=${encodeURIComponent(u.searchParams.get("error_description") ?? "cancelled")}`);

  let added = 0;
  const errors: string[] = [];
  const userToken = await facebookExchange(code!);
  for (const p of await listPages(userToken)) {
    const tok = encrypt(p.access_token);
    await sql`
      insert into accounts (workspace_id, platform, connection, external_id, name, avatar_url, access_token_enc, status)
      values (${st.wid}, 'facebook', 'facebook_login', ${p.id}, ${p.name}, ${p.picture?.data?.url ?? null}, ${tok}, 'active')
      on conflict (platform, external_id) do update set
        access_token_enc = excluded.access_token_enc, name = excluded.name, avatar_url = excluded.avatar_url,
        status = case when accounts.status in ('error','disconnected') then 'active' else accounts.status end, last_error = null
      where accounts.workspace_id = excluded.workspace_id`;
    added++;
    const ig = p.instagram_business_account;
    if (ig) {
      await sql`
        insert into accounts (workspace_id, platform, connection, external_id, page_id, name, username, avatar_url, access_token_enc, status)
        values (${st.wid}, 'instagram', 'facebook_login', ${ig.id}, ${p.id}, ${ig.name ?? ig.username ?? p.name}, ${ig.username ?? null}, ${ig.profile_picture_url ?? null}, ${tok}, 'active')
        on conflict (platform, external_id) do update set
          access_token_enc = excluded.access_token_enc, page_id = excluded.page_id, username = excluded.username, avatar_url = excluded.avatar_url,
          status = case when accounts.status in ('error','disconnected') then 'active' else accounts.status end, last_error = null
        where accounts.workspace_id = excluded.workspace_id`;
      added++;
    }
    try { await subscribePage(p.id, p.access_token); } catch (e: any) { errors.push(`${p.name}: ${e.message}`); }
  }
  redirect(`/app/accounts?added=${added}${errors.length ? `&error=${encodeURIComponent(errors.join(" | ").slice(0, 400))}` : ""}`);
}
