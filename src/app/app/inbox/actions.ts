"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { enqueue } from "@/lib/queue";

async function ownConv(wid: string, convId: string) {
  const [c] = await sql<any[]>`
    select c.*, ct.last_inbound_at from conversations c join accounts a on a.id = c.account_id join contacts ct on ct.id = c.contact_id
    where c.id = ${convId} and a.workspace_id = ${wid}`;
  if (!c) throw new Error("conversation not found");
  return c;
}

const hoursSince = (d: Date | null) => (d ? (Date.now() - new Date(d).getTime()) / 3600_000 : Infinity);

export async function sendDraft(form: FormData) {
  const s = await requireSession();
  const id = String(form.get("messageId"));
  const text = String(form.get("text") ?? "").trim();
  const [m] = await sql<any[]>`select m.*, a.workspace_id from messages m join accounts a on a.id = m.account_id where m.id = ${id}`;
  if (!m || m.workspace_id !== s.wid || !text) return;
  const c = await ownConv(s.wid, m.conversation_id);
  await sql`update messages set text = ${text}, route = 'human', ai = ai || ${sql.json({ sending: true })} where id = ${id}`;
  await enqueue("send", { messageId: id, humanAgent: m.kind === "dm" && hoursSince(c.last_inbound_at) > 24 }, { accountId: m.account_id });
  revalidatePath("/app/inbox");
  redirect(`/app/inbox?c=${m.conversation_id}&t=Sending`);
}

export async function discardDraft(form: FormData) {
  const s = await requireSession();
  const id = String(form.get("messageId"));
  await sql`delete from messages m using accounts a where m.id = ${id} and a.id = m.account_id and a.workspace_id = ${s.wid} and m.status = 'draft'`;
  revalidatePath("/app/inbox");
}

export async function manualReply(form: FormData) {
  const s = await requireSession();
  const convId = String(form.get("conversationId"));
  const text = String(form.get("text") ?? "").trim();
  if (!text) return;
  const c = await ownConv(s.wid, convId);
  const h = hoursSince(c.last_inbound_at);
  if (c.channel === "dm" && h > 24 * 7) redirect(`/app/inbox?c=${convId}&t=${encodeURIComponent("Meta only allows replies within 7 days of their last message")}`);
  const [lastIn] = await sql<any[]>`select external_id from messages where conversation_id = ${convId} and direction = 'in' order by created_at desc limit 1`;
  const [m] = await sql<any[]>`
    insert into messages (conversation_id, account_id, direction, kind, text, status, route, parent_external_id)
    values (${convId}, ${c.account_id}, 'out', ${c.channel === "dm" ? "dm" : "reply"}, ${text}, 'draft', 'human', ${lastIn?.external_id ?? null})
    returning id`;
  await enqueue("send", { messageId: m.id, humanAgent: c.channel === "dm" && h > 24 }, { accountId: c.account_id });
  revalidatePath("/app/inbox");
  redirect(`/app/inbox?c=${convId}&t=Sending`);
}

export async function setConversationStatus(form: FormData) {
  const s = await requireSession();
  const convId = String(form.get("conversationId"));
  const status = String(form.get("status"));
  if (!["bot", "human", "closed"].includes(status)) return;
  await ownConv(s.wid, convId);
  await sql`update conversations set status = ${status} where id = ${convId}`;
  revalidatePath("/app/inbox");
  redirect(`/app/inbox?c=${convId}&t=${encodeURIComponent(status === "bot" ? "Handed back to rply" : status === "closed" ? "Closed" : "You’re handling this one")}`);
}
