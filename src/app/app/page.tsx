import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { accounts, ago, money, needsYou } from "@/lib/data";
import { AccountArt } from "@/components/AccountArt";
import { Art } from "@/components/Art";

const ROUTE_LABEL: Record<string, string> = { rule: "Rule", cache: "Memory", llm: "AI", human: "You", skip: "Skipped" };
const ROUTE_CHIP: Record<string, string> = { rule: "chip-tomato", cache: "chip-violet", llm: "chip-lime", human: "chip-black", skip: "" };

export default async function Overview() {
  const s = await requireSession();
  const [accts, waiting, [today], [month]] = await Promise.all([
    accounts(s.wid),
    needsYou(s.wid),
    sql<{ replies: number; free: number; handled: number }[]>`
      select count(*) filter (where m.direction = 'out' and m.status = 'sent')::int as replies,
             count(*) filter (where m.direction = 'in' and m.route in ('rule','cache') and m.status in ('answered','ignored','hidden'))::int as free,
             count(*) filter (where m.direction = 'in' and m.route is not null and m.status in ('answered','ignored','hidden','handoff'))::int as handled
      from messages m join accounts a on a.id = m.account_id
      where a.workspace_id = ${s.wid} and m.created_at >= date_trunc('day', now())`,
    sql<{ cost: string; input: number; cached: number }[]>`
      select coalesce(sum(cost_usd),0) cost, coalesce(sum(input_tokens),0)::int input, coalesce(sum(cached_tokens),0)::int cached
      from usage_events where workspace_id = ${s.wid} and created_at >= date_trunc('month', now())`,
  ]);
  const recent = await sql<any[]>`
    select m.id, m.text, m.kind, m.route, m.status, m.created_at, a.name as account, a.platform, c.id as conv,
           coalesce(ct.name, ct.username, 'Someone') as who
    from messages m join accounts a on a.id = m.account_id join conversations c on c.id = m.conversation_id join contacts ct on ct.id = c.contact_id
    where a.workspace_id = ${s.wid} and m.direction = 'in' and m.route is not null
    order by m.created_at desc limit 8`;

  const live = accts.filter((a) => a.status === "active" && a.reply_mode !== "off").length;
  const freePct = today.handled ? Math.round((today.free / today.handled) * 100) : 0;
  const cachedPct = month.input ? Math.round((month.cached / month.input) * 100) : 0;

  if (accts.length === 0) {
    return (
      <section className="hero">
        <div className="hero-copy">
          <Art name="bub" size={220} eager />
          <h1 className="display">Connect a page to get started.</h1>
          <p className="lede" style={{ textAlign: "center" }}>Log in with Facebook to bring in all your Pages and their Instagram accounts at once, or connect an Instagram account on its own.</p>
          <Link href="/app/accounts#connect" className="btn">Connect accounts</Link>
        </div>
      </section>
    );
  }

  // shrink the number as it gets longer so it always fits its squircle
  const tile = (style: Record<string, string>, num: string, cap: string) => {
    return (
      <div className="tile" style={{ ...style, "--len": num.length } as any}><div>
        <div className="tile-num">{num}</div>
        <div className="tile-cap">{cap}</div>
      </div></div>
    );
  };

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <h1 className="display">
            {today.replies.toLocaleString()} {today.replies === 1 ? "reply" : "replies"} today.{" "}
            {waiting > 0 ? `${waiting} need${waiting === 1 ? "s" : ""} you.` : "Nothing needs you."}
          </h1>
          <p className="lede" style={{ textAlign: "center" }}>
            {waiting > 0 ? "rply wasn’t sure about these, so it wrote drafts and waited." : "Every conversation is with the bot or closed."}
          </p>
          <Link href={waiting > 0 ? "/app/inbox?f=human" : "/app/inbox"} className="btn">{waiting > 0 ? "Open what needs you" : "Open inbox"}</Link>
        </div>
        <div className="hero-tiles">
          {tile({ "--s": "118px", "--bg": "#000", "--fg": "#fff", left: "7%", top: "12%", "--rot": "-6deg", "--d": ".05s" }, `${live}/${accts.length}`, "accounts live")}
          {tile({ "--s": "132px", "--bg": "#ddff3b", left: "5%", top: "52%", "--rot": "5deg", "--d": ".14s" }, `${freePct}%`, "answered today with zero AI tokens")}
          {tile({ "--s": "112px", "--bg": "#8257ff", "--fg": "#fff", right: "9%", top: "9%", "--rot": "7deg", "--d": ".1s" }, money(Number(month.cost)), "AI spend this month")}
          {tile({ "--s": "104px", "--bg": "#8fd6ff", right: "17%", bottom: "8%", "--rot": "-8deg", "--d": ".26s" }, `${cachedPct}%`, "of prompt tokens cached")}
          <div className="tile" style={{ ["--s" as any]: "124px", ["--bg" as any]: waiting > 0 ? "#ff4a24" : "#fff", right: "4%", top: "42%", ["--rot" as any]: "3deg", ["--d" as any]: ".2s" }}>
            <Art name={waiting > 0 ? "bell-head" : "bub-head"} size={100} className="" eager />
          </div>
        </div>
      </section>

      <section className="deck">
        <div className="spread" style={{ marginBottom: 26 }}>
          <h2 className="h2">Busiest this week</h2>
          <Link href="/app/accounts" className="btn btn-sm btn-light">All accounts</Link>
        </div>
        <div className="grid-cards">
          {accts.slice(0, 8).map((a) => (
            <Link key={a.id} href={`/app/accounts?a=${a.id}`} className="acard">
              <AccountArt seed={a.id} platform={a.platform} status={a.status} label={a.squad_name ?? undefined} />
              <div className="acard-body">
                <div className="acard-name" dir="auto">{a.name}</div>
                <div className="meta">{a.replies_7d} replies in 7 days{a.pending ? `, ${a.pending} waiting` : ""}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="stage">
        <div className="stage-head"><h2 className="h2">Just handled</h2><Link href="/app/inbox" className="btn btn-sm btn-line">Inbox</Link></div>
        <ul className="list panel">
          {recent.length === 0 && <li className="empty"><span className="muted">Nothing yet. New comments and DMs show up here as soon as they’re answered.</span></li>}
          {recent.map((m) => (
            <li key={m.id}>
              <Link href={`/app/inbox?c=${m.conv}`} className="list-row">
                <span className={`chip ${ROUTE_CHIP[m.route] ?? ""}`} style={{ minWidth: 70, justifyContent: "center" }}>{ROUTE_LABEL[m.route] ?? m.route}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div dir="auto" style={{ fontWeight: 560, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>{m.text}</div>
                  <div className="meta">{m.who} on {m.account}, {m.kind === "dm" ? "DM" : "comment"}, {m.status === "handoff" ? "waiting for you" : m.status}</div>
                </div>
                <span className="meta">{ago(m.created_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
