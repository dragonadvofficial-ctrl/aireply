import { sql, vec } from "../db";
import { env } from "../env";
import type { BrainCtx } from "./context";
import { embed } from "./embed";
import { brainForPrompt, retrieve } from "./knowledge";
import { aiEnabled, aiKeyName, complete, models } from "./openai";
import { DECISION_SCHEMA, dynamicPrompt, staticPrompt, type Turn } from "./prompt";
import { clampReply, isNoise, isSpam, looksLikeComplaint, normalize, pick } from "./text";
import { overBudget, recordUsage } from "./usage";

/**
 * THE TOKEN LADDER — every inbound message climbs only as high as it needs:
 *
 *   0. filters ............ noise / tags / emoji / spam            → 0 tokens
 *   1. quick replies ...... keyword & regex rules                  → 0 tokens
 *   2. exact cache ........ same normalized question seen before   → 0 tokens
 *   3. semantic cache ..... similar question (embedding, 512-d)    → ~20 embed tokens
 *   4. LLM (fast) ......... cached static prefix + tiny dynamic    → cheap
 *   5. LLM (smart) ........ complaints / long DMs only             → rare
 *
 * Low confidence never auto-posts: it becomes a draft for a human.
 */

export type CommentAction = "public" | "private" | "both";

export type Decision = {
  route: "rule" | "cache" | "llm" | "skip";
  action: "reply" | "handoff" | "ignore" | "hide";
  reply?: string;
  privateReply?: string;
  /** set by a keyword rule: overrides the account's comment strategy */
  commentAction?: CommentAction;
  meta: {
    reason?: string; ruleId?: string; similarity?: number; model?: string; mode?: "stuffed" | "rag";
    input?: number; cached?: number; output?: number; cost?: number;
    intent?: string; sentiment?: string; confidence?: number; note?: string; ms?: number;
  };
};

export type DecideInput = {
  ctx: BrainCtx;
  channel: "comment" | "dm";
  text: string;
  contactName?: string | null;
  summary?: string;
  history?: Turn[];
  isFirstTurn: boolean;
};

const DEFAULT_THANKS = ["❤️", "نورتنا ❤️", "🙏❤️", "تسلم/ي ❤️"];
const DEFAULT_ACK = ["بعتنالك التفاصيل في الرسايل ✉️", "شيّك على الرسايل 💌", "ردينا عليك في الخاص ✨"];

export async function decide(input: DecideInput): Promise<Decision> {
  const t0 = Date.now();
  const d = await climb(input);
  d.meta.ms = Date.now() - t0;
  return applyStrategy(input, d);
}

async function climb(input: DecideInput): Promise<Decision> {
  const { ctx, channel, text } = input;
  const s = ctx.account.settings;

  // ── 0. filters
  if (channel === "comment" && isSpam(text)) {
    return s.hide_spam === false
      ? { route: "rule", action: "ignore", meta: { reason: "spam" } }
      : { route: "rule", action: "hide", meta: { reason: "spam" } };
  }
  if (channel === "comment" && isNoise(text)) {
    return s.noise === "thanks"
      ? { route: "rule", action: "reply", reply: pick(s.thanks_variants?.length ? s.thanks_variants : DEFAULT_THANKS), meta: { reason: "noise→thanks" } }
      : { route: "rule", action: "ignore", meta: { reason: "noise" } };
  }

  // ── 1. keyword rules
  const rule = await matchQuickReply(ctx, channel, text);
  const ruleAction: CommentAction | undefined = rule && rule.comment_action !== "account" ? rule.comment_action as CommentAction : undefined;
  if (rule) {
    await sql`update quick_replies set hits = hits + 1 where id = ${rule.id}`;
    if (rule.respond !== "ai") {
      const pub = rule.replies?.length ? pick(rule.replies) : undefined;
      const priv = rule.private_reply || undefined;
      return {
        route: "rule", action: "reply", commentAction: ruleAction,
        reply: channel === "dm" ? (pub ?? priv) : pub, privateReply: channel === "dm" ? undefined : priv,
        meta: { ruleId: rule.id, reason: `rule:${rule.name}` },
      };
    }
  }
  const aiRule = rule?.respond === "ai" ? rule : null;

  if (!aiEnabled()) return { route: "skip", action: "handoff", meta: { reason: `${aiKeyName()} missing` } };
  if (await overBudget(ctx.workspaceId)) return { route: "skip", action: "handoff", meta: { reason: "monthly AI budget reached" } };

  const complaint = looksLikeComplaint(text);
  const cacheEligible = !aiRule && !complaint && (channel === "comment" || input.isFirstTurn);
  const norm = normalize(text);

  // ── 2. exact cache
  if (cacheEligible && norm.length >= 2) {
    const [hit] = await sql<{ id: number; answer: string }[]>`
      select id, answer from reply_cache
      where scope_key = ${ctx.scopeKey} and question_norm = ${norm} and expires_at > now()
      order by hits desc limit 1`;
    if (hit) return cacheHit(hit, 1);
  }

  const brain = await brainForPrompt(ctx, env.AI_STUFF_KNOWLEDGE_TOKENS);

  // ── 3. semantic cache (+ reuse the same vector for retrieval)
  let embedding: number[] | null = null;
  if (cacheEligible || brain.mode === "rag") {
    [embedding] = await embed([text], { workspaceId: ctx.workspaceId, accountId: ctx.account.id });
  }
  if (cacheEligible && embedding) {
    const [hit] = await sql<{ id: number; answer: string; sim: number }[]>`
      select id, answer, 1 - (embedding <=> ${vec(embedding)}::vector) as sim
      from reply_cache
      where scope_key = ${ctx.scopeKey} and expires_at > now()
      order by embedding <=> ${vec(embedding)}::vector limit 1`;
    if (hit && hit.sim >= env.AI_CACHE_SIMILARITY) return cacheHit(hit, hit.sim);
  }

  // ── 4/5. LLM
  const retrieved = brain.mode === "rag" && embedding ? await retrieve(ctx, embedding) : [];
  const longDm = channel === "dm" && ((input.history?.length ?? 0) >= 8 || text.length > 500);
  const model = (complaint || longDm) && ctx.account.settings.smart_model !== false ? models().smart : models().fast;

  const res = await complete({
    model,
    system: staticPrompt(ctx, brain.staticText),
    user: dynamicPrompt({
      ctx, channel, text, contactName: input.contactName, summary: input.summary, history: input.history, retrieved,
      rule: aiRule ? [aiRule.instructions, aiRule.replies?.length ? `Example replies: ${aiRule.replies.join(" / ")}` : "", aiRule.private_reply ? `Private message data: ${aiRule.private_reply}` : ""].filter(Boolean).join("\n") : undefined,
      delivery: deliveryHint(channel, ruleAction ?? strategyAction(ctx.account.settings.comment_strategy)),
    }),
    schema: { name: "reply_decision", schema: DECISION_SCHEMA },
    maxTokens: env.AI_REASONING_EFFORT ? 1200 : 400,
    cacheKey: `rply:${ctx.scopeKey}`,
    reasoning: env.AI_REASONING_EFFORT || undefined,
  });

  const usage = { input: res.input, cached: res.cached, output: res.output };
  const cost = await recordUsage({ workspaceId: ctx.workspaceId, accountId: ctx.account.id, kind: "chat", model, route: "llm", ...usage });

  let out: any;
  try { out = JSON.parse(res.text); } catch { return { route: "llm", action: "handoff", meta: { model, ...usage, cost, reason: "unparseable model output" } }; }

  const maxChars = Math.min(ctx.persona.max_chars, ctx.account.platform === "instagram" ? 950 : 1900);
  let action: Decision["action"] = out.action;
  if (action === "reply" && out.confidence < 0.6) action = "handoff";
  if (action === "hide" && channel === "dm") action = "ignore";

  const decision: Decision = {
    route: "llm", action, commentAction: ruleAction,
    reply: out.reply ? clampReply(out.reply, maxChars) : undefined,
    privateReply: out.private_reply ? clampReply(out.private_reply, maxChars) : undefined,
    meta: { model, mode: brain.mode, ...usage, cost, intent: out.intent, sentiment: out.sentiment, confidence: out.confidence, note: out.note || undefined,
            ...(aiRule ? { ruleId: aiRule.id, reason: `rule:${aiRule.name} (AI)` } : {}) },
  };

  // learn: next time this question costs 0 tokens
  if (cacheEligible && embedding && action === "reply" && out.cacheable && out.confidence >= 0.8 && decision.reply) {
    await sql`insert into reply_cache (workspace_id, scope_key, question, question_norm, embedding, answer)
              values (${ctx.workspaceId}, ${ctx.scopeKey}, ${text.slice(0, 500)}, ${norm}, ${vec(embedding)}::vector,
                      ${JSON.stringify({ reply: decision.reply, private: decision.privateReply ?? "" })})`;
  }
  return decision;
}

async function cacheHit(hit: { id: number; answer: string }, similarity: number): Promise<Decision> {
  await sql`update reply_cache set hits = hits + 1 where id = ${hit.id}`;
  const a = JSON.parse(hit.answer);
  return { route: "cache", action: "reply", reply: a.reply, privateReply: a.private || undefined, meta: { similarity: +similarity.toFixed(3) } };
}

type QuickReply = {
  id: string; name: string; triggers: string[]; match: string; channel: string; replies: string[]; private_reply: string | null; scope: string;
  respond: "fixed" | "ai"; instructions: string; comment_action: "account" | CommentAction;
};

async function matchQuickReply(ctx: BrainCtx, channel: "comment" | "dm", text: string): Promise<QuickReply | null> {
  const rows = await sql<QuickReply[]>`
    select id, name, triggers, match, channel, replies, private_reply, scope, respond, instructions, comment_action from quick_replies
    where workspace_id = ${ctx.workspaceId} and enabled and (channel = 'any' or channel = ${channel})
      and (scope = 'workspace' or (scope = 'squad' and scope_id = ${ctx.squad?.id ?? null}) or (scope = 'account' and scope_id = ${ctx.account.id}))
    order by case scope when 'account' then 0 when 'squad' then 1 else 2 end, created_at`;
  const norm = ` ${normalize(text)} `;
  const words = squeeze(text).split(" ").filter(Boolean);
  const bare = ` ${words.map(stripPrefix).join(" ")} `;          // "وبكاااام" → "بكام"
  const full = ` ${words.join(" ")} `;
  const has = (t: string) => {
    const nt = squeeze(t);
    if (!nt) return false;
    return [full, bare].some((m) => m.includes(` ${nt} `) || (nt.includes(" ") && m.includes(nt)));
  };
  for (const r of rows) {
    if (r.respond !== "ai" && !r.replies?.length && !r.private_reply) continue;
    const hit = r.match === "all" ? r.triggers.length > 0 && r.triggers.every(has) : r.triggers.some((t) => {
      if (r.match === "regex") { try { return new RegExp(t, "iu").test(text); } catch { return false; } }
      return r.match === "exact" ? [norm.trim(), full.trim()].includes(squeeze(t)) || norm.trim() === normalize(t) : has(t);
    });
    if (hit) return r;
  }
  return null;
}

/** matching-only form: also collapses doubled letters ("بكاام" → "بكام") */
const squeeze = (t: string) => normalize(t).replace(/(\p{L})\1+/gu, "$1");
/** Arabic conjunction glued to the word: و / ف (keep short words intact) */
const stripPrefix = (w: string) => (w.length > 3 && /^[وف]/.test(w) ? w.slice(1) : w);

const strategyAction = (s?: string): CommentAction | undefined =>
  s === "public" ? "public" : s === "private" ? "private" : s === "private_first" ? "both" : undefined;   // smart → model decides

function deliveryHint(channel: "comment" | "dm", a?: CommentAction) {
  if (channel !== "comment") return undefined;
  if (a === "private") return `Your answer will be sent ONLY as a private message to the commenter. Put the full answer in "private_reply"; "reply" can stay empty.`;
  if (a === "public") return `Only a public comment reply will be sent. Put everything in "reply"; leave "private_reply" empty.`;
  if (a === "both") return `A short public reply AND a private message will be sent. "reply" = one short public line; "private_reply" = the full details.`;
  return undefined;
}

/** Where comment replies go: a matched rule's choice wins, otherwise the account's strategy. */
function applyStrategy(input: DecideInput, d: Decision): Decision {
  if (input.channel !== "comment" || d.action !== "reply") {
    if (input.channel === "dm") d.privateReply = undefined;
    return d;
  }
  const s = input.ctx.account.settings;
  const mode = d.commentAction ?? strategyAction(s.comment_strategy);
  const ack = () => pick(s.public_ack?.length ? s.public_ack : DEFAULT_ACK);
  if (mode === "public") {
    d.reply = d.reply || d.privateReply;
    d.privateReply = undefined;
  } else if (mode === "private") {
    d.privateReply = d.privateReply || d.reply;
    d.reply = undefined;
  } else if (mode === "both") {
    const details = d.privateReply || d.reply;
    // a rule with its own public text keeps it; otherwise a short "check your DMs" line
    d.reply = d.route === "rule" && d.reply && d.privateReply ? d.reply : ack();
    d.privateReply = details;
  }
  if (!d.reply && !d.privateReply) return { ...d, action: "ignore", meta: { ...d.meta, reason: "nothing to send" } };
  return d;
}
