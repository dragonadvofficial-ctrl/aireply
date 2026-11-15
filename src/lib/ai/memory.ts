import { sql } from "../db";
import { env } from "../env";
import { ai, aiEnabled } from "./openai";
import { recordUsage } from "./usage";

const EVERY = 12; // re-summarize after this many new messages

/**
 * Rolling memory: instead of re-sending a long chat history on every reply,
 * we keep a ≤60-word summary + the last 6 turns. Flat token cost per reply,
 * no matter how long the conversation gets.
 */
export async function maybeSummarize(conversationId: string) {
  if (!aiEnabled()) return;
  const [c] = await sql<any[]>`
    select c.*, a.workspace_id from conversations c join accounts a on a.id = c.account_id where c.id = ${conversationId}`;
  if (!c || c.message_count - c.summarized_n < EVERY) return;

  const msgs = await sql<{ direction: string; text: string }[]>`
    select direction, text from messages where conversation_id = ${conversationId} and kind <> 'note'
    order by created_at desc limit ${EVERY + 6}`;
  const transcript = msgs.reverse().map((m) => `${m.direction === "in" ? "customer" : "brand"}: ${m.text.slice(0, 300)}`).join("\n");

  const res = await ai().responses.create({
    model: env.AI_MODEL_FAST,
    input: [
      { role: "developer", content: "Update the running summary of a customer conversation. ≤60 words. Keep: what they want, products/sizes/quantities, promises the brand made, open issues, their mood. Same language as the chat. Output only the summary." },
      { role: "user", content: `PREVIOUS SUMMARY: ${c.summary || "(none)"}\n\nNEW MESSAGES:\n${transcript}` },
    ],
    max_output_tokens: 160,
    store: false,
  });
  await recordUsage({
    workspaceId: c.workspace_id, accountId: c.account_id, kind: "summary", model: env.AI_MODEL_FAST, route: "memory",
    input: res.usage?.input_tokens ?? 0, cached: res.usage?.input_tokens_details?.cached_tokens ?? 0, output: res.usage?.output_tokens ?? 0,
  });
  await sql`update conversations set summary = ${res.output_text.trim().slice(0, 800)}, summarized_n = message_count where id = ${conversationId}`;
}
