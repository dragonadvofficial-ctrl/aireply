import { env } from "../env";
import { hmacSha256Hex, safeEqual } from "../crypto";

/** X-Hub-Signature-256 — FB app secret and IG app secret are different, accept either. */
export function verifySignature(raw: string, header: string | null): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const sig = header.slice(7);
  return [env.META_APP_SECRET, env.INSTAGRAM_APP_SECRET].filter(Boolean)
    .some((secret) => safeEqual(hmacSha256Hex(secret, raw), sig));
}

export type Inbound = {
  platform: "facebook" | "instagram";
  accountExternalId: string;     // page id / IG account id (entry.id)
  kind: "comment" | "dm";
  externalId: string;            // comment id / message mid
  parentId?: string;             // replying to another comment
  postId?: string;               // post / media id
  from: { id: string; name?: string; username?: string };
  text: string;
  at: Date;
  attachments?: { type: string; url?: string }[];
};

/** Normalize Page + Instagram webhook payloads into one shape. Ignores echoes and our own replies. */
export function normalize(body: any): Inbound[] {
  const out: Inbound[] = [];
  const platform: Inbound["platform"] = body?.object === "instagram" ? "instagram" : "facebook";
  if (body?.object !== "page" && body?.object !== "instagram") return out;

  for (const entry of body.entry ?? []) {
    const acct = String(entry.id);

    // ── DMs (Messenger + IG Direct share the shape)
    for (const m of entry.messaging ?? []) {
      if (m.message?.is_echo || m.message?.is_self || m.message?.is_deleted) continue;
      const fromId = String(m.sender?.id ?? "");
      if (!fromId || fromId === acct) continue;
      const text = m.message?.text ?? m.message?.quick_reply?.payload ?? m.postback?.title ?? "";
      const atts = (m.message?.attachments ?? []).map((a: any) => ({ type: a.type, url: a.payload?.url }));
      if (!text && atts.length === 0) continue;
      out.push({
        platform, accountExternalId: acct, kind: "dm",
        externalId: m.message?.mid ?? m.postback?.mid ?? `${fromId}:${m.timestamp}`,
        from: { id: fromId }, text: text || `[${atts.map((a: any) => a.type).join(", ")}]`,
        at: new Date(m.timestamp ?? Date.now()), attachments: atts,
      });
    }

    // ── Comments
    for (const ch of entry.changes ?? []) {
      const v = ch.value ?? {};
      if (platform === "facebook" && ch.field === "feed" && v.item === "comment" && v.verb === "add") {
        const fromId = String(v.from?.id ?? "");
        if (!fromId || fromId === acct) continue;              // our own reply
        out.push({
          platform, accountExternalId: acct, kind: "comment", externalId: String(v.comment_id),
          parentId: v.parent_id && v.parent_id !== v.post_id ? String(v.parent_id) : undefined,
          postId: String(v.post_id), from: { id: fromId, name: v.from?.name }, text: v.message ?? "",
          at: new Date((v.created_time ?? Date.now() / 1000) * 1000),
        });
      }
      if (platform === "instagram" && (ch.field === "comments" || ch.field === "live_comments")) {
        const fromId = String(v.from?.id ?? "");
        if (!fromId || fromId === acct || v.from?.self_ig_scoped_id) continue;
        out.push({
          platform, accountExternalId: acct, kind: "comment", externalId: String(v.id),
          parentId: v.parent_id ? String(v.parent_id) : undefined, postId: String(v.media?.id ?? ""),
          from: { id: fromId, username: v.from?.username }, text: v.text ?? "", at: new Date(),
        });
      }
    }
  }
  return out;
}
