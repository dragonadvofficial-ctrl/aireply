import { sql, vec } from "../db";
import { embed } from "./embed";
import { estimateTokens } from "./text";
import { bumpBrain, type BrainCtx } from "./context";

/** Paragraph-aware chunking (~350 tokens, small overlap). FAQ pairs stay intact. */
export function chunk(text: string, maxTokens = 350): string[] {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}|(?=\n(?:Q:|س:|سؤال:))/).map((b) => b.trim()).filter(Boolean);
  const out: string[] = [];
  let cur = "";
  for (const b of blocks) {
    if (estimateTokens(cur + "\n\n" + b) > maxTokens && cur) { out.push(cur); cur = cur.split("\n").slice(-1)[0]; }
    if (estimateTokens(b) > maxTokens) {
      for (const line of b.split("\n")) {
        if (estimateTokens(cur + "\n" + line) > maxTokens && cur) { out.push(cur); cur = ""; }
        cur = cur ? cur + "\n" + line : line;
      }
    } else cur = cur ? cur + "\n\n" + b : b;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n").trim();
}

/** (Re)build chunks + embeddings for one source. Runs in the worker. */
export async function ingestSource(sourceId: string) {
  const [s] = await sql<any[]>`select * from knowledge_sources where id = ${sourceId}`;
  if (!s) return;
  let content: string = s.content;
  if (s.kind === "url" && s.meta?.url && !content) {
    try {
      const r = await fetch(s.meta.url, { signal: AbortSignal.timeout(15_000), headers: { "user-agent": "rply-bot/1.0" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      content = htmlToText(await r.text()).slice(0, 60_000);
    } catch (e: any) {
      await sql`update knowledge_sources set status = 'error', meta = meta || ${sql.json({ error: e.message })} where id = ${s.id}`;
      return;
    }
  }
  const pieces = chunk(content);
  const vectors = await embed(pieces, { workspaceId: s.workspace_id });
  await sql.begin(async (tx: any) => {
    await tx`delete from knowledge_chunks where source_id = ${s.id}`;
    for (let i = 0; i < pieces.length; i++) {
      await tx`insert into knowledge_chunks (source_id, workspace_id, scope, scope_id, content, tokens, embedding)
               values (${s.id}, ${s.workspace_id}, ${s.scope}, ${s.scope_id}, ${pieces[i]}, ${estimateTokens(pieces[i])}, ${vec(vectors[i])}::vector)`;
    }
    await tx`update knowledge_sources set content = ${content}, tokens = ${estimateTokens(content)}, status = 'ready', updated_at = now() where id = ${s.id}`;
  });
  await bumpBrain(s.workspace_id);
}

// accounts see: workspace-wide brain + their squad's brain + their own brain
const scopeFilter = (ctx: BrainCtx) => sql`workspace_id = ${ctx.workspaceId} and (
    scope = 'workspace'
    or (scope = 'squad' and scope_id = ${ctx.squad?.id ?? null})
    or (scope = 'account' and scope_id = ${ctx.account.id}))`;

/**
 * Two strategies:
 *  - small brain (≤ AI_STUFF_KNOWLEDGE_TOKENS): put everything in the *static* prompt prefix.
 *    It's identical for every message of the squad → OpenAI prompt cache serves it at ~90% off.
 *  - big brain: pinned sources in the prefix + top-k retrieved chunks in the dynamic part.
 */
export async function brainForPrompt(ctx: BrainCtx, stuffLimit: number) {
  const sources = await sql<{ id: string; title: string; content: string; tokens: number; pinned: boolean; kind: string }[]>`
    select id, title, content, tokens, pinned, kind from knowledge_sources
    where ${scopeFilter(ctx)} and status = 'ready'
    order by scope, pinned desc, created_at, id`; // 'account' < 'squad' < 'workspace' → most specific first
  const total = sources.reduce((n, s) => n + s.tokens, 0);
  const fmt = (s: { title: string; content: string }) => `## ${s.title}\n${s.content.trim()}`;
  if (total <= stuffLimit) return { mode: "stuffed" as const, staticText: sources.map(fmt).join("\n\n"), total };
  return { mode: "rag" as const, staticText: sources.filter((s) => s.pinned).map(fmt).join("\n\n"), total };
}

export async function retrieve(ctx: BrainCtx, embedding: number[], k = 4, maxTokens = 900) {
  const rows = await sql<{ content: string; tokens: number; score: number }[]>`
    select c.content, c.tokens, 1 - (c.embedding <=> ${vec(embedding)}::vector) as score
    from knowledge_chunks c
    where c.workspace_id = ${ctx.workspaceId}
      and (c.scope = 'workspace'
        or (c.scope = 'squad' and c.scope_id = ${ctx.squad?.id ?? null})
        or (c.scope = 'account' and c.scope_id = ${ctx.account.id}))
      and not exists (select 1 from knowledge_sources s where s.id = c.source_id and s.pinned)
    order by c.embedding <=> ${vec(embedding)}::vector
    limit ${k}`;
  const out: string[] = [];
  let used = 0;
  for (const r of rows) {
    if (r.score < 0.25 || used + r.tokens > maxTokens) continue;
    out.push(r.content); used += r.tokens;
  }
  return out;
}
