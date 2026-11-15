// Central config. Never throws at import time (so `next build` works without secrets);
// call `must()` where a value is truly required.
const e = process.env;

export const env = {
  APP_URL: (e.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  SESSION_SECRET: e.SESSION_SECRET ?? "",
  ENCRYPTION_KEY: e.ENCRYPTION_KEY ?? "",

  DATABASE_URL: e.DATABASE_URL ?? "",
  WORKER_DATABASE_URL: e.WORKER_DATABASE_URL || e.DATABASE_URL || "",
  DB_PREPARE: (e.DB_PREPARE ?? "true") !== "false",
  DB_POOL_MAX: Number(e.DB_POOL_MAX ?? 10),

  OPENAI_API_KEY: e.OPENAI_API_KEY ?? "",
  AI_MODEL_FAST: e.AI_MODEL_FAST || "gpt-6-luna",
  AI_MODEL_SMART: e.AI_MODEL_SMART || "gpt-6.1-terra",
  AI_EMBED_MODEL: e.AI_EMBED_MODEL || "text-embedding-3-small",
  AI_REASONING_EFFORT: (e.AI_REASONING_EFFORT || "") as "" | "minimal" | "low" | "medium",
  AI_CACHE_SIMILARITY: Number(e.AI_CACHE_SIMILARITY ?? 0.93),
  AI_STUFF_KNOWLEDGE_TOKENS: Number(e.AI_STUFF_KNOWLEDGE_TOKENS ?? 2500),

  META_GRAPH_VERSION: e.META_GRAPH_VERSION || "v26.0",
  META_APP_ID: e.META_APP_ID ?? "",
  META_APP_SECRET: e.META_APP_SECRET ?? "",
  META_LOGIN_CONFIG_ID: e.META_LOGIN_CONFIG_ID ?? "",
  META_WEBHOOK_VERIFY_TOKEN: e.META_WEBHOOK_VERIFY_TOKEN ?? "",
  INSTAGRAM_APP_ID: e.INSTAGRAM_APP_ID ?? "",
  INSTAGRAM_APP_SECRET: e.INSTAGRAM_APP_SECRET ?? "",

  WORKER_CONCURRENCY: Number(e.WORKER_CONCURRENCY ?? 8),
  WORKER_POLL_MS: Number(e.WORKER_POLL_MS ?? 700),
};

export function must<K extends keyof typeof env>(key: K): NonNullable<(typeof env)[K]> {
  const v = env[key];
  if (v === "" || v === undefined || v === null) throw new Error(`Missing env: ${key}`);
  return v as NonNullable<(typeof env)[K]>;
}
