import { env } from "../env";
import { ai } from "./openai";
import { recordUsage } from "./usage";

export const EMBED_DIMS = 512; // text-embedding-3-small supports shortened vectors: smaller index, ~same recall

export async function embed(texts: string[], ctx: { workspaceId: string; accountId?: string | null }): Promise<number[][]> {
  if (texts.length === 0) return [];
  const r = await ai().embeddings.create({ model: env.AI_EMBED_MODEL, input: texts.map((t) => t.slice(0, 8000)), dimensions: EMBED_DIMS });
  await recordUsage({ workspaceId: ctx.workspaceId, accountId: ctx.accountId, kind: "embed", model: env.AI_EMBED_MODEL, input: r.usage?.total_tokens ?? 0 });
  return r.data.map((d) => d.embedding);
}
