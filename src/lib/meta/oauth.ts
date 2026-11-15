import { env, must } from "../env";
import { graph, graphAll } from "./graph";

/* ───────────── Facebook Login for Business (Pages + IG accounts linked to Pages) ─────────────
   One login can return many Pages at once → the fastest way to onboard 100 accounts. */
export const FB_SCOPES = [
  "pages_show_list", "pages_manage_metadata", "pages_read_engagement", "pages_read_user_content",
  "pages_manage_engagement", "pages_messaging", "business_management",
  "instagram_basic", "instagram_manage_comments", "instagram_manage_messages",
];
export const FB_PAGE_FIELDS = ["feed", "messages", "messaging_postbacks"];

export function facebookLoginUrl(state: string) {
  const u = new URL(`https://www.facebook.com/${env.META_GRAPH_VERSION}/dialog/oauth`);
  u.searchParams.set("client_id", must("META_APP_ID"));
  u.searchParams.set("redirect_uri", `${env.APP_URL}/api/meta/callback/facebook`);
  u.searchParams.set("state", state);
  u.searchParams.set("response_type", "code");
  if (env.META_LOGIN_CONFIG_ID) {
    u.searchParams.set("config_id", env.META_LOGIN_CONFIG_ID);       // Login for Business config holds the scopes
    u.searchParams.set("override_default_response_type", "true");
  } else {
    u.searchParams.set("scope", FB_SCOPES.join(","));
  }
  return u.toString();
}

export async function facebookExchange(code: string) {
  const short = await graph<{ access_token: string }>("facebook", "oauth/access_token", {
    query: { client_id: must("META_APP_ID"), client_secret: must("META_APP_SECRET"), redirect_uri: `${env.APP_URL}/api/meta/callback/facebook`, code },
  });
  const long = await graph<{ access_token: string }>("facebook", "oauth/access_token", {
    query: { grant_type: "fb_exchange_token", client_id: env.META_APP_ID, client_secret: env.META_APP_SECRET, fb_exchange_token: short.access_token },
  });
  return long.access_token; // long-lived user token → page tokens derived from it don't expire
}

export type FbPage = {
  id: string; name: string; access_token: string; picture?: { data?: { url?: string } };
  instagram_business_account?: { id: string; username?: string; name?: string; profile_picture_url?: string };
};
export async function listPages(userToken: string) {
  return graphAll<FbPage>("facebook", "me/accounts", userToken, {
    fields: "id,name,access_token,picture{url},instagram_business_account{id,username,name,profile_picture_url}",
  });
}
export async function subscribePage(pageId: string, pageToken: string) {
  await graph("facebook", `${pageId}/subscribed_apps`, { method: "POST", token: pageToken, query: { subscribed_fields: FB_PAGE_FIELDS.join(",") } });
}

/* ───────────── Business Login for Instagram (no Facebook Page needed) ───────────── */
export const IG_SCOPES = ["instagram_business_basic", "instagram_business_manage_messages", "instagram_business_manage_comments"];

export function instagramLoginUrl(state: string) {
  const u = new URL("https://www.instagram.com/oauth/authorize");
  u.searchParams.set("client_id", must("INSTAGRAM_APP_ID"));
  u.searchParams.set("redirect_uri", `${env.APP_URL}/api/meta/callback/instagram`);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", IG_SCOPES.join(","));
  u.searchParams.set("state", state);
  return u.toString();
}

export async function instagramExchange(code: string) {
  const form = new URLSearchParams({
    client_id: must("INSTAGRAM_APP_ID"), client_secret: must("INSTAGRAM_APP_SECRET"),
    grant_type: "authorization_code", redirect_uri: `${env.APP_URL}/api/meta/callback/instagram`, code,
  });
  const r = await fetch("https://api.instagram.com/oauth/access_token", { method: "POST", body: form });
  const short = await r.json();
  if (!r.ok || !short.access_token) throw new Error(`IG token exchange failed: ${JSON.stringify(short).slice(0, 300)}`);
  const long = await graph<{ access_token: string; expires_in: number }>("instagram", "https://graph.instagram.com/access_token", {
    query: { grant_type: "ig_exchange_token", client_secret: env.INSTAGRAM_APP_SECRET, access_token: short.access_token },
  });
  return { token: long.access_token, expiresAt: new Date(Date.now() + long.expires_in * 1000) };
}

/** IG Login tokens live 60 days → the worker refreshes them weekly. */
export async function instagramRefresh(token: string) {
  const r = await graph<{ access_token: string; expires_in: number }>("instagram", "https://graph.instagram.com/refresh_access_token", {
    query: { grant_type: "ig_refresh_token", access_token: token },
  });
  return { token: r.access_token, expiresAt: new Date(Date.now() + r.expires_in * 1000) };
}

export async function instagramMe(token: string) {
  // user_id here is the IG professional account id that appears as entry.id in webhooks
  return graph<{ user_id: string; username: string; name?: string; profile_picture_url?: string }>("instagram", "me", {
    token, query: { fields: "user_id,username,name,profile_picture_url" },
  });
}
export async function instagramSubscribe(token: string) {
  await graph("instagram", "me/subscribed_apps", { method: "POST", token, query: { subscribed_fields: "comments,messages" } });
}
