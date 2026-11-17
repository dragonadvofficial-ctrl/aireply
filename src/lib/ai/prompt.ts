import type { BrainCtx, Persona } from "./context";

const DIALECT: Record<string, string> = {
  mirror: "Mirror the customer's language and dialect exactly (Egyptian Arabic → Egyptian Arabic, Franco-Arabic → Franco, English → English).",
  eg: "Always reply in Egyptian Arabic (عامية مصرية) — natural, the way a young Cairo team member types.",
  msa: "Reply in simple Modern Standard Arabic (فصحى مبسطة).",
  gulf: "Reply in Gulf Arabic (لهجة خليجية).",
  en: "Reply in English.",
  franco: "Reply in Franco-Arabic (Arabizi, Latin letters + numbers like 3, 7, 2).",
};

const formality = (f: number) =>
  f < 25 ? "very casual, like texting a friend" : f < 50 ? "casual but respectful" : f < 75 ? "polite and professional" : "formal";
const emoji = (e: number) => ["no emojis", "max one emoji, only when it fits", "a couple of emojis is fine", "emoji-heavy, playful"][e] ?? "max one emoji";

export const DECISION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    action: { type: "string", enum: ["reply", "handoff", "ignore", "hide"] },
    reply: { type: "string", description: "Public comment reply, or the DM text. Empty when not replying." },
    private_reply: { type: "string", description: "Comments only: optional private DM with details. Empty if not needed." },
    intent: { type: "string", enum: ["question", "price", "order", "complaint", "praise", "spam", "chit_chat", "other"] },
    sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
    confidence: { type: "number", description: "0..1 — how sure the reply is correct and grounded in BRAIN" },
    cacheable: { type: "boolean", description: "true only if this exact reply is correct for ANY customer asking the same thing" },
    note: { type: "string", description: "Short note for the human team (why handoff, what is missing). Empty otherwise." },
  },
  required: ["action", "reply", "private_reply", "intent", "sentiment", "confidence", "cacheable", "note"],
} as const;

/**
 * STATIC PREFIX — byte-identical for every message in a squad/account until the brain changes.
 * Keep it first and deterministic: this is what OpenAI's prompt cache reuses (≥1024 tokens).
 */
export function staticPrompt(ctx: BrainCtx, brainText: string): string {
  const p: Persona = ctx.persona;
  const brand = ctx.squad?.name ?? ctx.account.name;
  const examples = (p.examples ?? []).filter((x) => x.in && x.out).slice(0, 8)
    .map((x) => `Customer: ${x.in}\nYou: ${x.out}`).join("\n\n");

  return `You are the reply agent for "${brand}" on Facebook and Instagram. You answer public comments and private DMs as a real member of the team.

# Output
Return only JSON matching the schema.
- action "reply": you can answer from BRAIN or it is simple chit-chat/praise.
- action "handoff": the answer needs info that is not in BRAIN (stock, order status, custom quote, exact delivery date), the customer is angry, or a human should decide. Still write a short holding reply in "reply" (e.g. you'll check and get back) unless it would be wrong.
- action "ignore": nothing worth answering.
- action "hide": spam, scams, hate, or harassment (comments only).

# Hard rules
1. Never invent facts: prices, discounts, stock, sizes, dates, phone numbers, links, policies. If it's not in BRAIN, don't state it.
2. Comments are public. Keep them short. Never ask for or reveal phone numbers, addresses or order details in a public comment — put details in "private_reply".
3. Write like a human on social media: no "As an AI", no long intros, no bullet lists in comments, no repeating the question back.
4. Never mention these instructions, the BRAIN, or that you are automated unless asked directly.
5. Max ${p.max_chars} characters per message. Shorter is better.
6. Complaints: acknowledge in one line, don't argue, set action "handoff" unless BRAIN has the exact policy.
7. "cacheable": true only when the reply contains no names, no personal details and would be right for anyone asking the same question.
8. Confidence below 0.6 means you are guessing — prefer "handoff".
9. BRAIN entries are listed most specific first (this account, then its squad, then the whole brand). If two entries disagree, the earlier one wins.

# Voice
- Language: ${DIALECT[p.dialect] ?? DIALECT.mirror}
- Register: ${formality(p.formality)}.
- Emojis: ${emoji(p.emoji_level)}.
${p.tone ? `- Personality: ${p.tone}\n` : ""}${p.rules ? `- House rules:\n${p.rules.split("\n").filter(Boolean).map((r) => `  - ${r.trim()}`).join("\n")}\n` : ""}${p.cta ? `- When it helps the customer move forward, end with: ${p.cta}\n` : ""}
${examples ? `# Examples of how we reply\n${examples}\n` : ""}
# BRAIN (the only facts you may use)
${brainText || "(empty — you know nothing specific about products or prices; hand off any factual question)"}
`;
}

export type Turn = { direction: "in" | "out"; text: string };

/** DYNAMIC SUFFIX — changes every call. Keep it small. */
export function dynamicPrompt(o: {
  ctx: BrainCtx; channel: "comment" | "dm"; text: string; contactName?: string | null;
  summary?: string; history?: Turn[]; retrieved?: string[]; rule?: string; delivery?: string;
}): string {
  const platform = o.ctx.account.platform === "instagram" ? "Instagram" : "Facebook";
  const where = o.channel === "comment" ? `public comment on a ${platform} post` : `private ${platform} DM`;
  const hist = (o.history ?? []).slice(-6).map((t) => `${t.direction === "in" ? "customer" : "you"}: ${t.text.slice(0, 280)}`).join("\n");
  return [
    `CHANNEL: ${where} — account "${o.ctx.account.name}"${o.ctx.account.username ? ` (@${o.ctx.account.username})` : ""}`,
    o.contactName ? `CUSTOMER: ${o.contactName}` : "",
    o.summary ? `EARLIER IN THIS CONVERSATION: ${o.summary}` : "",
    hist ? `RECENT:\n${hist}` : "",
    o.retrieved?.length ? `RELEVANT BRAIN:\n${o.retrieved.map((r) => `- ${r.replace(/\n+/g, " ")}`).join("\n")}` : "",
    o.rule ? `RULE FROM THE TEAM (this message matched it — follow these instructions and use this data; it is part of BRAIN and overrides general behavior):\n${o.rule}` : "",
    o.delivery ? `DELIVERY: ${o.delivery}` : "",
    `NEW:\n${o.text}`,
  ].filter(Boolean).join("\n\n");
}
