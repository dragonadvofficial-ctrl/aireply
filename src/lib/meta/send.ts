import { decrypt } from "../crypto";
import { graph, type Host } from "./graph";

export type AccountRow = {
  id: string; platform: "facebook" | "instagram"; connection: "facebook_login" | "instagram_login";
  external_id: string; page_id: string | null; access_token_enc: string | null;
};

const host = (a: AccountRow): Host => (a.connection === "instagram_login" ? "instagram" : "facebook");
const token = (a: AccountRow) => { if (!a.access_token_enc) throw new Error("account has no token"); return decrypt(a.access_token_enc); };

/** Public reply under a comment. */
export async function replyToComment(a: AccountRow, commentId: string, text: string) {
  const edge = a.platform === "facebook" ? "comments" : "replies";
  return graph<{ id: string }>(host(a), `${commentId}/${edge}`, { method: "POST", token: token(a), query: { message: text } });
}

/** One private DM to the commenter (Meta allows exactly one, within 7 days of the comment). */
export async function privateReply(a: AccountRow, commentId: string, text: string) {
  return graph<{ message_id: string }>(host(a), "me/messages", {
    method: "POST", token: token(a), body: { recipient: { comment_id: commentId }, message: { text } },
  });
}

/** DM inside the 24h window. `humanAgent` adds the HUMAN_AGENT tag (7 days, humans only — never for bot replies). */
export async function sendDM(a: AccountRow, recipientId: string, text: string, opts: { humanAgent?: boolean } = {}) {
  return graph<{ message_id: string }>(host(a), "me/messages", {
    method: "POST", token: token(a),
    body: {
      recipient: { id: recipientId }, message: { text },
      ...(opts.humanAgent ? { messaging_type: "MESSAGE_TAG", tag: "HUMAN_AGENT" } : { messaging_type: "RESPONSE" }),
    },
  });
}

export async function typing(a: AccountRow, recipientId: string) {
  try {
    await graph(host(a), "me/messages", { method: "POST", token: token(a), body: { recipient: { id: recipientId }, sender_action: "typing_on" } });
  } catch { /* cosmetic */ }
}

export async function hideComment(a: AccountRow, commentId: string) {
  return graph(host(a), commentId, { method: "POST", token: token(a), query: a.platform === "facebook" ? { is_hidden: true } : { hide: true } });
}
