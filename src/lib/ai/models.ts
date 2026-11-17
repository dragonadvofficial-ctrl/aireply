// USD per 1M tokens — OpenAI pricing page (standard tier), checked Nov 2026.
// Update here when prices change; usage + budgets read from this table.
export const PRICES: Record<string, { in: number; cached: number; out: number }> = {
  "gpt-6-luna": { in: 0.10, cached: 0.01, out: 0.50 },
  "gpt-6.1-terra": { in: 1.00, cached: 0.05, out: 5.00 },
  "gpt-6.1-sol": { in: 2.00, cached: 0.10, out: 10.00 },
  "gpt-6-sol": { in: 2.00, cached: 0.20, out: 10.00 },
  "gpt-5.6-luna": { in: 0.20, cached: 0.02, out: 1.20 },
  "gpt-5.4-mini": { in: 0.75, cached: 0.075, out: 4.50 },
  "gpt-5.4-nano": { in: 0.20, cached: 0.02, out: 1.25 },
  "gpt-4.1-mini": { in: 0.40, cached: 0.10, out: 1.60 },
  "gemini-2.5-flash": { in: 0.30, cached: 0.03, out: 2.50 },
  "gemini-2.5-pro": { in: 1.25, cached: 0.125, out: 10.00 },
  "gemini-embedding-001": { in: 0.15, cached: 0.15, out: 0 },
  "text-embedding-3-small": { in: 0.02, cached: 0.02, out: 0 },
  "text-embedding-3-large": { in: 0.13, cached: 0.13, out: 0 },
};

export function costUsd(model: string, input: number, cached: number, output: number) {
  const p = PRICES[model] ?? PRICES["gpt-6.1-terra"];
  return ((input - cached) * p.in + cached * p.cached + output * p.out) / 1_000_000;
}
