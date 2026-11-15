import { env } from "../env";

export type Host = "facebook" | "instagram";
export const graphBase = (host: Host) =>
  process.env.META_GRAPH_BASE_OVERRIDE                       // tests only: point at a local mock
    ? `${process.env.META_GRAPH_BASE_OVERRIDE}/${host}/${env.META_GRAPH_VERSION}`
    : `https://graph.${host === "instagram" ? "instagram" : "facebook"}.com/${env.META_GRAPH_VERSION}`;

export class MetaError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: number,
    public subcode?: number,
    public retryable = false,
    public tokenInvalid = false,
  ) { super(message); }
}

// Meta error codes worth knowing:
//   4, 17, 32, 613, 80001-80009 → rate limiting (retry later)
//   190 → token expired/invalid (reconnect)   10 / 200-299 → permission
//   551 / 2018108 / 10 (sub 2018278) → user unavailable / outside window
const RATE_CODES = new Set([4, 17, 32, 613, 80001, 80002, 80003, 80004, 80005, 80006, 80008, 80009]);

export async function graph<T = any>(
  host: Host,
  path: string,
  opts: { method?: "GET" | "POST" | "DELETE"; token?: string; query?: Record<string, string | number | boolean | undefined>; body?: unknown } = {},
): Promise<T> {
  const url = new URL(path.startsWith("http") ? path : `${graphBase(host)}/${path.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));
  if (opts.token) url.searchParams.set("access_token", opts.token);

  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers: opts.body ? { "content-type": "application/json" } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  let data: any;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

  if (!res.ok || data?.error) {
    const e = data?.error ?? {};
    const code = Number(e.code);
    throw new MetaError(
      `[meta ${code || res.status}${e.error_subcode ? "/" + e.error_subcode : ""}] ${e.message ?? res.statusText}`,
      res.status, code, Number(e.error_subcode) || undefined,
      RATE_CODES.has(code) || res.status >= 500 || e.is_transient === true,
      code === 190,
    );
  }
  return data as T;
}

/** Follow `paging.next` cursors (e.g. /me/accounts for agencies with 100+ pages). */
export async function graphAll<T>(host: Host, path: string, token: string, query: Record<string, string> = {}): Promise<T[]> {
  const out: T[] = [];
  let next: string | undefined = undefined;
  let page = await graph<{ data: T[]; paging?: { next?: string } }>(host, path, { token, query: { limit: "100", ...query } });
  for (let i = 0; i < 50; i++) {
    out.push(...(page.data ?? []));
    next = page.paging?.next;
    if (!next) break;
    page = await graph(host, next);
  }
  return out;
}
