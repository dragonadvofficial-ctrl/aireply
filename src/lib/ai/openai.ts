import OpenAI from "openai";
import { env, must } from "../env";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai/";
const gemini = () => env.AI_PROVIDER === "gemini";

let client: OpenAI | null = null;
export function ai(): OpenAI {
  if (client) return client;
  client = gemini()
    ? new OpenAI({ apiKey: must("GEMINI_API_KEY"), baseURL: GEMINI_BASE, maxRetries: 2, timeout: 30_000 })
    : new OpenAI({ apiKey: must("OPENAI_API_KEY"), maxRetries: 2, timeout: 30_000 });
  return client;
}
export const aiEnabled = () => Boolean(gemini() ? env.GEMINI_API_KEY : env.OPENAI_API_KEY);
export const aiKeyName = () => (gemini() ? "GEMINI_API_KEY" : "OPENAI_API_KEY");

/** Model names for the active provider (Vercel may still hold the OpenAI names, so Gemini has its own). */
export const models = () => gemini()
  ? { fast: env.GEMINI_MODEL_FAST, smart: env.GEMINI_MODEL_SMART, embed: env.GEMINI_EMBED_MODEL }
  : { fast: env.AI_MODEL_FAST, smart: env.AI_MODEL_SMART, embed: env.AI_EMBED_MODEL };

/** Gemini's schema dialect rejects a few JSON-schema keys. */
function geminiSchema(x: any): any {
  if (Array.isArray(x)) return x.map(geminiSchema);
  if (x && typeof x === "object") {
    const o: any = {};
    for (const [k, v] of Object.entries(x)) if (k !== "additionalProperties" && k !== "$schema") o[k] = geminiSchema(v);
    return o;
  }
  return x;
}

export type Completion = { text: string; input: number; cached: number; output: number };

/** One text/JSON completion on either provider. */
export async function complete(o: {
  model: string; system: string; user: string; maxTokens: number;
  schema?: { name: string; schema: any }; cacheKey?: string; reasoning?: string;
}): Promise<Completion> {
  if (!gemini()) {
    const res = await ai().responses.create({
      model: o.model,
      input: [{ role: "developer", content: o.system }, { role: "user", content: o.user }],
      ...(o.schema ? { text: { format: { type: "json_schema", name: o.schema.name, schema: o.schema.schema, strict: true } } } : {}),
      max_output_tokens: o.maxTokens,
      ...(o.cacheKey ? { prompt_cache_key: o.cacheKey } : {}),
      store: false,
      ...(o.reasoning ? { reasoning: { effort: o.reasoning as any } } : {}),
    } as any);
    const u: any = res.usage;
    return { text: res.output_text, input: u?.input_tokens ?? 0, cached: u?.input_tokens_details?.cached_tokens ?? 0, output: u?.output_tokens ?? 0 };
  }
  // Gemini via its OpenAI-compatible Chat Completions endpoint. Thinking tokens count toward the limit, so keep it roomy.
  const res: any = await ai().chat.completions.create({
    model: o.model,
    messages: [{ role: "system", content: o.system }, { role: "user", content: o.user }],
    ...(o.schema ? { response_format: { type: "json_schema", json_schema: { name: o.schema.name, schema: geminiSchema(o.schema.schema), strict: true } } } : {}),
    max_tokens: Math.max(o.maxTokens * 4, 2000),
    reasoning_effort: (o.reasoning || "low") as any,
  } as any);
  const u = res.usage;
  return {
    text: res.choices?.[0]?.message?.content ?? "",
    input: u?.prompt_tokens ?? 0,
    cached: u?.prompt_tokens_details?.cached_tokens ?? 0,
    output: u?.completion_tokens ?? 0,
  };
}
