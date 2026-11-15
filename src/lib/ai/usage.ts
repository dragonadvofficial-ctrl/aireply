import { sql } from "../db";
import { costUsd } from "./models";

export async function recordUsage(u: {
  workspaceId: string; accountId?: string | null; kind: "chat" | "embed" | "summary";
  model: string; route?: string; input: number; cached?: number; output?: number;
}) {
  const cost = costUsd(u.model, u.input, u.cached ?? 0, u.output ?? 0);
  await sql`insert into usage_events (workspace_id, account_id, kind, model, route, input_tokens, cached_tokens, output_tokens, cost_usd)
            values (${u.workspaceId}, ${u.accountId ?? null}, ${u.kind}, ${u.model}, ${u.route ?? null}, ${u.input}, ${u.cached ?? 0}, ${u.output ?? 0}, ${cost})`;
  return cost;
}

export async function monthSpend(workspaceId: string): Promise<number> {
  const [r] = await sql<{ s: string }[]>`
    select coalesce(sum(cost_usd), 0) s from usage_events
    where workspace_id = ${workspaceId} and created_at >= date_trunc('month', now())`;
  return Number(r.s);
}

export async function overBudget(workspaceId: string): Promise<boolean> {
  const [w] = await sql<{ b: string }[]>`select monthly_budget_usd b from workspaces where id = ${workspaceId}`;
  return (await monthSpend(workspaceId)) >= Number(w?.b ?? 0);
}
