import { requireSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { money } from "@/lib/data";
import { setBudget } from "./actions";

const ROUTES: [string, string, string][] = [["rule", "Instant replies and filters", "#ff4a24"], ["cache", "From memory", "#8257ff"], ["llm", "AI", "#ddff3b"], ["skip", "Not answered", "#8a8a86"]];

export default async function Usage() {
  const s = await requireSession();
  const [[ws], [tot], byRoute, byModel, byAcct, daily] = await Promise.all([
    sql<any[]>`select monthly_budget_usd from workspaces where id = ${s.wid}`,
    sql<any[]>`select coalesce(sum(cost_usd),0)::float cost, coalesce(sum(input_tokens),0)::int input, coalesce(sum(cached_tokens),0)::int cached, coalesce(sum(output_tokens),0)::int output
               from usage_events where workspace_id = ${s.wid} and created_at >= date_trunc('month', now())`,
    sql<any[]>`select m.route, count(*)::int n from messages m join accounts a on a.id = m.account_id
               where a.workspace_id = ${s.wid} and m.direction = 'in' and m.route is not null and m.created_at >= date_trunc('month', now()) group by 1`,
    sql<any[]>`select model, kind, count(*)::int calls, sum(cost_usd)::float cost, sum(input_tokens)::int input, sum(cached_tokens)::int cached
               from usage_events where workspace_id = ${s.wid} and created_at >= date_trunc('month', now()) group by 1,2 order by cost desc`,
    sql<any[]>`select a.name, a.platform, coalesce(sum(u.cost_usd),0)::float cost, count(u.id)::int calls
               from accounts a left join usage_events u on u.account_id = a.id and u.created_at >= date_trunc('month', now())
               where a.workspace_id = ${s.wid} group by a.id order by cost desc limit 15`,
    sql<any[]>`select to_char(g.d, 'DD') as dd, coalesce(sum(u.cost_usd),0)::float cost
               from generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') as g(d)
               left join usage_events u on u.workspace_id = ${s.wid} and date_trunc('day', u.created_at) = g.d group by g.d order by g.d`,
  ]);
  const budget = Number(ws.monthly_budget_usd);
  const totalMsgs = byRoute.reduce((n, r) => n + r.n, 0);
  const aiCalls = byRoute.find((r) => r.route === "llm")?.n ?? 0;
  const avgAi = aiCalls ? (byModel.filter((m) => m.kind === "chat").reduce((n, m) => n + m.cost, 0) / aiCalls) : 0;
  const free = byRoute.filter((r) => r.route === "rule" || r.route === "cache").reduce((n, r) => n + r.n, 0);
  const maxDay = Math.max(...daily.map((d) => d.cost), 0.0001);

  return (
    <>
      <section className="stage">
        <div className="stage-head">
          <div>
            <h1 className="display" style={{ fontSize: "clamp(40px, 6vw, 76px)" }}>{money(tot.cost)} of {money(budget)}</h1>
            <p className="lede" style={{ marginTop: 14 }}>AI spend this month. When the budget runs out, rply keeps sending instant replies and answers from memory, and turns everything else into drafts for you.</p>
          </div>
          <form action={setBudget} className="row" style={{ flexWrap: "nowrap" }}>
            <label className="sr-only" htmlFor="budget">Monthly budget in USD</label>
            <input id="budget" name="budget" type="number" min={0} step={1} defaultValue={budget} className="input" style={{ width: 120 }} />
            <button className="btn">Set budget</button>
          </form>
        </div>
        <div className="bar" style={{ height: 18, border: "1.5px solid #000" }}><i style={{ width: `${Math.min(100, (tot.cost / Math.max(budget, 0.01)) * 100)}%`, background: tot.cost > budget * 0.85 ? "var(--tomato)" : "#000" }} /></div>
      </section>

      <section className="deck">
        <div className="split">
          <div className="stack" style={{ gap: 18 }}>
            <h2 className="h2">How messages were answered</h2>
            <p className="muted" style={{ margin: 0 }}>{totalMsgs.toLocaleString()} messages this month. {totalMsgs ? `${Math.round((free / totalMsgs) * 100)}% needed no AI` : ""}{avgAi && free ? `, about ${money(free * avgAi)} you didn’t spend.` : "."}</p>
            {ROUTES.map(([k, label, color]) => {
              const n = byRoute.find((r) => r.route === k)?.n ?? 0;
              return (
                <div key={k} className="stack" style={{ gap: 6 }}>
                  <div className="spread"><span>{label}</span><span className="num">{n.toLocaleString()}</span></div>
                  <div className="bar" style={{ background: "#222" }}><i style={{ width: `${totalMsgs ? (n / totalMsgs) * 100 : 0}%`, background: color }} /></div>
                </div>
              );
            })}
          </div>
          <div className="stack" style={{ gap: 18 }}>
            <h2 className="h2">Last 14 days</h2>
            <div className="cols" role="img" aria-label="Daily AI spend for the last 14 days">
              {daily.map((d) => (
                <div key={d.dd} title={money(d.cost)}><i style={{ height: `${(d.cost / maxDay) * 130}px`, background: d.cost ? "#fff" : "#333" }} /><span className="meta">{d.dd}</span></div>
              ))}
            </div>
            <p className="muted" style={{ margin: 0 }}>{tot.input ? `${Math.round((tot.cached / tot.input) * 100)}% of prompt tokens came from the model’s cache this month.` : "No AI calls yet this month."}</p>
          </div>
        </div>
      </section>

      <section className="stage">
        <div className="split">
          <div className="panel">
            <h2 className="h3 panel-pad" style={{ paddingBottom: 6 }}>By model</h2>
            <ul className="list">
              {byModel.length === 0 && <li className="list-row muted">Nothing yet.</li>}
              {byModel.map((m) => (
                <li key={m.model + m.kind} className="list-row spread"><span>{m.model} <span className="meta">{m.kind === "chat" ? "replies" : m.kind === "embed" ? "search and memory" : "summaries"}, {m.calls} calls</span></span><span className="num">{money(m.cost)}</span></li>
              ))}
            </ul>
          </div>
          <div className="panel">
            <h2 className="h3 panel-pad" style={{ paddingBottom: 6 }}>By account</h2>
            <ul className="list">
              {byAcct.map((a) => (
                <li key={a.name + a.platform} className="list-row spread"><span dir="auto">{a.name} <span className="meta">{a.platform === "instagram" ? "IG" : "FB"}, {a.calls} calls</span></span><span className="num">{money(a.cost)}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
