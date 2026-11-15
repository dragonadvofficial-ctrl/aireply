import { sql } from "../db";
import { enqueue } from "../queue";
import type { Inbound } from "../meta/webhook";

const DM_DEBOUNCE_MS = 5_000;

/**
 * Webhook → DB in one short transaction, then return 200 to Meta immediately.
 * Idempotent: Meta retries deliveries, the unique (account_id, external_id) index drops duplicates.
 */
export async function ingest(events: Inbound[]) {
  let queued = 0;
  for (const ev of events) {
    const [acct] = await sql<{ id: string; status: string; reply_mode: string; settings: any }[]>`
      select id, status, reply_mode, settings from accounts where platform = ${ev.platform} and external_id = ${ev.accountExternalId}`;
    if (!acct) continue;

    await sql.begin(async (tx: any) => {
      const [contact] = await tx`
        insert into contacts (account_id, external_id, name, username, last_inbound_at)
        values (${acct.id}, ${ev.from.id}, ${ev.from.name ?? null}, ${ev.from.username ?? null}, ${ev.at})
        on conflict (account_id, external_id) do update set
          name = coalesce(excluded.name, contacts.name), username = coalesce(excluded.username, contacts.username),
          last_inbound_at = greatest(contacts.last_inbound_at, excluded.last_inbound_at)
        returning id`;
      const thread = ev.kind === "dm" ? "dm" : ev.postId || "unknown";
      const [conv] = await tx`
        insert into conversations (account_id, contact_id, channel, thread_ref, last_message_at)
        values (${acct.id}, ${contact.id}, ${ev.kind}, ${thread}, ${ev.at})
        on conflict (account_id, channel, thread_ref, contact_id) do update set last_message_at = excluded.last_message_at
        returning id, status`;
      const inserted = await tx`
        insert into messages (conversation_id, account_id, direction, kind, external_id, parent_external_id, text, created_at)
        values (${conv.id}, ${acct.id}, 'in', ${ev.kind}, ${ev.externalId}, ${ev.parentId ?? null}, ${ev.text}, ${ev.at})
        on conflict (account_id, external_id) where external_id is not null do nothing
        returning id`;
      if (inserted.length === 0) return;                                  // duplicate delivery
      await tx`update conversations set message_count = message_count + 1 where id = ${conv.id}`;

      const s = acct.settings ?? {};
      const enabled = acct.status === "active" && acct.reply_mode !== "off" && conv.status === "bot"
        && (ev.kind === "dm" ? s.dms !== false : s.comments !== false);
      if (!enabled) return;

      const [lo, hi] = s.reply_delay_sec ?? [4, 15];
      const delay = ev.kind === "dm" ? DM_DEBOUNCE_MS : (lo + Math.random() * Math.max(0, hi - lo)) * 1000;
      // one queued job per conversation → bursts of messages get answered once
      await enqueue("reply", { conversationId: conv.id }, { accountId: acct.id, dedupeKey: `reply:${conv.id}`, delayMs: delay }, tx);
      queued++;
    });
  }
  return queued;
}
