import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { instagramExchange, instagramMe, instagramSubscribe } from "@/lib/meta/oauth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const st = await verifyToken<{ wid: string }>(u.searchParams.get("state") ?? "");
  if (!st) return new Response("invalid state", { status: 400 });
  const code = u.searchParams.get("code");
  if (!code) redirect(`/app/accounts?error=${encodeURIComponent(u.searchParams.get("error_description") ?? "cancelled")}`);

  const { token, expiresAt } = await instagramExchange(code!.replace(/#_$/, ""));
  const me = await instagramMe(token);
  await sql`
    insert into accounts (workspace_id, platform, connection, external_id, name, username, avatar_url, access_token_enc, token_expires_at, status)
    values (${st.wid}, 'instagram', 'instagram_login', ${me.user_id}, ${me.name ?? me.username}, ${me.username}, ${me.profile_picture_url ?? null}, ${encrypt(token)}, ${expiresAt}, 'active')
    on conflict (platform, external_id) do update set
      connection = 'instagram_login', access_token_enc = excluded.access_token_enc, token_expires_at = excluded.token_expires_at,
      username = excluded.username, avatar_url = excluded.avatar_url, status = 'active', last_error = null
    where accounts.workspace_id = excluded.workspace_id`;
  let err = "";
  try { await instagramSubscribe(token); } catch (e: any) { err = e.message; }
  redirect(`/app/accounts?added=1${err ? `&error=${encodeURIComponent(err)}` : ""}`);
}
