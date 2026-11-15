import { sql } from "../db";
import { encrypt, decrypt } from "../crypto";
import { loadContext } from "../ai/context";
import { ingestSource } from "../ai/knowledge";
import { maybeSummarize } from "../ai/memory";
import { decide, type Decision } from "../ai/pipeline";
import { MetaError } from "../meta/graph";
import { instagramRefresh } from "../meta/oauth";
import { hideComment, privateReply, replyToComment, sendDM, typing } from "../meta/send";
import { defer, enqueue, type Job } from "../queue";
import { take } from "../rate";

export class RateDeferred extends Error { constructor(public ms: number) { super(`rate limited, retry in ${ms}ms`); } }

export async function runJob(job: Job) {
  switch (job.kind) {
    case "reply": return handleReply(job);
    case "send": return handleSend(job);
    case "ingest_source": return ingestSource(job.payload.sourceId);
    case "summarize": return maybeSummarize(job.payload.conversationId);
    case "refresh_tokens": return refreshTokens();
    default: throw new Error(`unknown job kind ${job.kind}`);
  }
}

/* ───────────────────────── reply: think + act ───────────────────────── */

async function handleReply(job: Job) {
  const { conversationId } = job.payload as { conversationId: string; decision?: Decision; pendingIds?: string[] };
  const [conv] = await sql<any[]>`
    select c.*, ct.external_id as contact_ext, ct.name as contact_name, ct.username as contact_username, ct.last_inbound_at
    from conversations c join contacts ct on ct.id = c.contact_id where c.id = ${conversationId}`;
  if (!conv || conv.status !== "bot") return;

  const ctx = await loadContext(conv.account_id);
  const acct = ctx.account;
  const pending = await sql<{ id: string; text: string; external_id: string; kind: string; created_at: Date }[]>`
    select id, text, external_id, kind, created_at from messages
    where conversation_id = ${conversationId} and direction = 'in' and status = 'received' order by created_at`;
  if (pending.length === 0) return;

  if (acct.status !== "active" || acct.reply_mode === "off") {
    await markIn(pending.map((p) => p.id), "ignored", "skip");
    return;
  }

  // Reuse a decision made before a rate-limit deferral (never pay twice for the same thought).
  let decision: Decision | undefined = job.payload.decision;
  if (!decision) {
    const history = await sql<{ direction: "in" | "out"; text: string }[]>`
      select direction, text from (
        select direction, text, created_at from messages
        where conversation_id = ${conversationId} and status not in ('received','draft','failed') and kind <> 'note'
        order by created_at desc limit 6) h order by created_at`;
    decision = await decide({
      ctx, channel: conv.channel, text: pending.map((p) => p.text).join("\n"),
      contactName: conv.contact_name ?? conv.contact_username, summary: conv.summary || undefined,
      history, isFirstTurn: conv.message_count <= pending.length,
    });
  }

  const inIds = pending.map((p) => p.id);
  const last = pending[pending.length - 1];
  const aiMeta = { ...decision.meta, route: decision.route };

  if (decision.action === "ignore") return markIn(inIds, "ignored", decision.route, aiMeta);

  if (decision.action === "hide") {
    await guard(job, decision, () => hideComment(acct, last.external_id));
    return markIn(inIds, "hidden", decision.route, aiMeta);
  }

  // Draft mode or handoff → park for a human, keep the draft
  if (decision.action === "handoff" || acct.reply_mode === "draft") {
    if (decision.action === "handoff") await sql`update conversations set status = 'human' where id = ${conversationId}`;
    if (decision.reply) await insertOut(conversationId, acct.id, conv.channel === "dm" ? "dm" : "reply", decision.reply, "draft", decision.route, aiMeta, last.external_id);
    if (decision.privateReply) await insertOut(conversationId, acct.id, "private_reply", decision.privateReply, "draft", decision.route, aiMeta, last.external_id);
    return markIn(inIds, "handoff", decision.route, aiMeta);
  }

  // Auto-send
  if (conv.channel === "dm") {
    if (!within(conv.last_inbound_at, 24)) {      // Meta 24h standard window
      await sql`update conversations set status = 'human' where id = ${conversationId}`;
      await insertOut(conversationId, acct.id, "dm", decision.reply!, "draft", decision.route, { ...aiMeta, note: "outside 24h window" });
      return markIn(inIds, "handoff", decision.route, aiMeta);
    }
    await guard(job, decision, async () => {
      await typing(acct, conv.contact_ext);
      const r = await sendDM(acct, conv.contact_ext, decision!.reply!);
      await insertOut(conversationId, acct.id, "dm", decision!.reply!, "sent", decision!.route, aiMeta, undefined, r.message_id);
    }, "dm_send");
  } else {
    if (decision.reply) {
      await guard(job, decision, async () => {
        const r = await replyToComment(acct, last.external_id, decision!.reply!);
        await insertOut(conversationId, acct.id, "reply", decision!.reply!, "sent", decision!.route, aiMeta, last.external_id, r.id);
      }, "comment_reply");
    }
    if (decision.privateReply && within(last.created_at, 24 * 7)) {
      await guard(job, { ...decision, reply: undefined }, async () => {
        const r = await privateReply(acct, last.external_id, decision!.privateReply!);
        await insertOut(conversationId, acct.id, "private_reply", decision!.privateReply!, "sent", decision!.route, aiMeta, last.external_id, r.message_id);
      }, "private_reply");
    }
  }
  await markIn(inIds, "answered", decision.route, aiMeta);
  await sql`update conversations set message_count = message_count + 1 where id = ${conversationId}`;
  await enqueue("summarize", { conversationId }, { dedupeKey: `sum:${conversationId}`, delayMs: 60_000 });
}

/** Rate-limit + Meta error handling around a send. */
async function guard(job: Job, decision: Decision, fn: () => Promise<unknown>, bucket?: "dm_send" | "comment_reply" | "private_reply") {
  if (bucket) {
    const wait = await take(job.account_id!, bucket);
    if (wait > 0) {
      job.payload.decision = decision;
      await sql`update jobs set payload = ${sql.json(job.payload)} where id = ${job.id}`;
      throw new RateDeferred(wait);
    }
  }
  try { await fn(); }
  catch (e) {
    if (e instanceof MetaError) {
      if (e.tokenInvalid) {
        await sql`update accounts set status = 'error', last_error = ${e.message} where id = ${job.account_id}`;
        throw e;
      }
      if (e.retryable) {
        job.payload.decision = decision;
        await sql`update jobs set payload = ${sql.json(job.payload)} where id = ${job.id}`;
      }
    }
    throw e;
  }
}

/* ───────────────────────── send: a human approved a draft ───────────────────────── */

async function handleSend(job: Job) {
  const { messageId, humanAgent } = job.payload as { messageId: string; humanAgent?: boolean };
  const [m] = await sql<any[]>`
    select m.*, c.channel, ct.external_id as contact_ext from messages m
    join conversations c on c.id = m.conversation_id join contacts ct on ct.id = c.contact_id where m.id = ${messageId}`;
  if (!m || m.status === "sent") return;
  const ctx = await loadContext(m.account_id);
  let ext: string | undefined;
  if (m.kind === "dm") ext = (await sendDM(ctx.account, m.contact_ext, m.text, { humanAgent })).message_id;
  else if (m.kind === "reply") ext = (await replyToComment(ctx.account, m.parent_external_id, m.text)).id;
  else if (m.kind === "private_reply") ext = (await privateReply(ctx.account, m.parent_external_id, m.text)).message_id;
  await sql`update messages set status = 'sent', external_id = coalesce(${ext ?? null}, external_id) where id = ${messageId}`;
  await sql`update messages set status = 'answered' where conversation_id = ${m.conversation_id} and direction = 'in' and status = 'handoff'`;
}

/* ───────────────────────── maintenance ───────────────────────── */

async function refreshTokens() {
  const rows = await sql<any[]>`
    select id, access_token_enc from accounts
    where connection = 'instagram_login' and status <> 'disconnected' and token_expires_at < now() + interval '20 days'`;
  for (const r of rows) {
    try {
      const t = await instagramRefresh(decrypt(r.access_token_enc));
      await sql`update accounts set access_token_enc = ${encrypt(t.token)}, token_expires_at = ${t.expiresAt}, last_error = null where id = ${r.id}`;
    } catch (e: any) {
      await sql`update accounts set status = 'error', last_error = ${"token refresh failed: " + e.message} where id = ${r.id}`;
    }
  }
}

/* ───────────────────────── helpers ───────────────────────── */

const within = (d: Date | string | null, hours: number) => !!d && Date.now() - new Date(d).getTime() < hours * 3600_000;

async function markIn(ids: string[], status: string, route: string, ai: object = {}) {
  if (ids.length) await sql`update messages set status = ${status}, route = ${route}, ai = ${sql.json(ai as any)} where id in ${sql(ids)}`;
}

async function insertOut(conversationId: string, accountId: string, kind: string, text: string, status: string, route: string, ai: object, parentExt?: string, ext?: string) {
  await sql`insert into messages (conversation_id, account_id, direction, kind, text, status, route, ai, parent_external_id, external_id)
            values (${conversationId}, ${accountId}, 'out', ${kind}, ${text}, ${status}, ${route}, ${sql.json(ai as any)}, ${parentExt ?? null}, ${ext ?? null})`;
}

export { defer };
