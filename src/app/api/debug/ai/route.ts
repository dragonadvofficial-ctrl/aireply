import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { models } from "@/lib/ai/openai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BASE = "https://generativelanguage.googleapis.com/v1beta/openai";

/** Temporary diagnostic: times the raw Gemini calls the app makes. Protected by the webhook verify token. */
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("key") !== env.META_WEBHOOK_VERIFY_TOKEN) return new NextResponse("no", { status: 401 });
  const out: Record<string, string> = { provider: env.AI_PROVIDER, has_key: String(Boolean(env.GEMINI_API_KEY)) };
  const m = models();
  out.models = JSON.stringify(m);

  async function call(name: string, path: string, body: unknown) {
    const t = Date.now();
    try {
      const r = await fetch(`${BASE}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${env.GEMINI_API_KEY}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });
      const txt = await r.text();
      out[name] = `${r.status} ${Date.now() - t}ms ${txt.slice(0, 220).replace(/\s+/g, " ")}`;
    } catch (e: any) {
      out[name] = `FAIL ${Date.now() - t}ms ${String(e?.message ?? e).slice(0, 160)}`;
    }
  }

  await call("embed", "/embeddings", { model: m.embed, input: ["hello"], dimensions: 512 });
  await call("chat_plain", "/chat/completions", { model: m.fast, messages: [{ role: "user", content: "say ok" }], max_tokens: 2000, reasoning_effort: "low" });
  await call("chat_no_reasoning_param", "/chat/completions", { model: m.fast, messages: [{ role: "user", content: "say ok" }], max_tokens: 2000 });
  return NextResponse.json(out);
}
