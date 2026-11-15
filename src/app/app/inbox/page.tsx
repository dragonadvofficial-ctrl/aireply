import Link from "next/link";
import { ArrowLeft, FacebookLogo, InstagramLogo } from "@phosphor-icons/react/dist/ssr";
import { requireSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ago, money } from "@/lib/data";
import { Toast } from "@/components/Toast";
import { Art } from "@/components/Art";
import { look } from "@/components/characters";
import { discardDraft, manualReply, sendDraft, setConversationStatus } from "./actions";

const FILTERS = [["all", "All"], ["human", "Needs you"], ["bot", "With rply"], ["closed", "Closed"]] as const;
const ROUTE: Record<string, string> = { rule: "rule", cache: "memory", llm: "AI", human: "you", skip: "skipped" };

export default async function Inbox({ searchParams }: { searchParams: Promise<{ f?: string; c?: string; t?: string }> }) {
  const s = await requireSession();
  const { f = "all", c: selected, t } = await searchParams;
  const convs = await sql<any[]>`
    select c.id, c.channel, c.status, c.last_message_at, c.contact_id, a.name as account, a.platform,
           coalesce(ct.name, '@' || ct.username, 'Someone') as who,
           (select text from messages m where m.conversation_id = c.id order by created_at desc limit 1) as last_text,
           (select count(*)::int from messages m where m.conversation_id = c.id and m.status = 'draft') as drafts
    from conversations c join accounts a on a.id = c.account_id join contacts ct on ct.id = c.contact_id
    where a.workspace_id = ${s.wid} ${f === "all" ? sql`` : sql`and c.status = ${f}`}
    order by (c.status = 'human') desc, c.last_message_at desc limit 80`;

  const active = selected ?? convs[0]?.id;
  const threadOpen = Boolean(selected);
  const [conv] = active ? await sql<any[]>`
    select c.*, a.name as account, a.platform, a.username as account_username, ct.name, ct.username, ct.last_inbound_at
    from conversations c join accounts a on a.id = c.account_id join contacts ct on ct.id = c.contact_id
    where c.id = ${active} and a.workspace_id = ${s.wid}` : [];
  const msgs = conv ? await sql<any[]>`select * from messages where conversation_id = ${conv.id} order by created_at, direction` : [];

  return (
    <section className="stage">
      <div className="stage-head">
        <div><h1 className="h2">Inbox</h1><p className="lede">Comments and DMs from every connected account. Drafts are replies rply wrote but didn’t send.</p></div>
        <nav className="tabs" aria-label="Filter">
          {FILTERS.map(([k, label]) => <Link key={k} className="tab" href={`/app/inbox?f=${k}`} aria-current={f === k ? "page" : undefined}>{label}</Link>)}
        </nav>
      </div>

      <div className="inbox" data-thread={threadOpen ? "true" : "false"}>
        <ul className="list panel inbox-list" style={{ maxHeight: "74vh", overflowY: "auto" }}>
          {convs.length === 0 && <li className="empty"><Art name="bell" size={150} /><span className="muted">{f === "human" ? "Nothing needs you right now." : "No conversations here yet."}</span></li>}
          {convs.map((c) => (
            <li key={c.id}>
              <Link href={`/app/inbox?f=${f}&c=${c.id}`} className="list-row" aria-current={c.id === active ? "true" : undefined}>
                <span style={{ position: "relative", flex: "none" }}>
                  <span className="cmt-av" style={{ width: 44, height: 44, background: look(c.contact_id).fill }}><Art name={`${look(c.contact_id).char}-head`} size={44} className="" /></span>
                  <span style={{ position: "absolute", right: -4, bottom: -4, background: "#fff", borderRadius: 99, padding: 2, display: "grid" }}>{c.platform === "instagram" ? <InstagramLogo size={14} weight="bold" /> : <FacebookLogo size={14} weight="fill" />}</span>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="spread"><strong dir="auto" className="clip">{c.who}</strong><span className="meta" style={{ flex: "none" }}>{ago(c.last_message_at)}</span></div>
                  <div dir="auto" className="muted clip">{c.last_text}</div>
                  <div className="row" style={{ gap: 6, marginTop: 6 }}>
                    <span className="meta">{c.account}, {c.channel === "dm" ? "DM" : "comment"}</span>
                    {c.status === "human" && <span className="chip chip-tomato" style={{ height: 22 }}>needs you</span>}
                    {c.drafts > 0 && <span className="chip chip-lime" style={{ height: 22 }}>draft</span>}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <div className="panel inbox-thread" style={{ minHeight: 420, display: "grid", gridTemplateRows: "auto 1fr auto" }}>
          {!conv ? <div className="empty"><span className="muted">Pick a conversation.</span></div> : (
            <>
              <div className="spread" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
                <Link href={`/app/inbox?f=${f}`} className="btn btn-sm btn-line btn-icon inbox-back" aria-label="Back to conversations"><ArrowLeft size={18} /></Link>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <strong dir="auto" style={{ fontSize: 17 }}>{conv.name ?? (conv.username ? "@" + conv.username : "Someone")}</strong>
                  <div className="meta">{conv.channel === "dm" ? "Direct message" : "Comment thread"} on {conv.account}</div>
                </div>
                <form action={setConversationStatus} className="row">
                  <input type="hidden" name="conversationId" value={conv.id} />
                  {conv.status !== "bot" && <button name="status" value="bot" className="btn btn-sm btn-line">Hand back to rply</button>}
                  {conv.status === "bot" && <button name="status" value="human" className="btn btn-sm btn-line">Take over</button>}
                  {conv.status !== "closed" && <button name="status" value="closed" className="btn btn-sm btn-line">Close</button>}
                </form>
              </div>

              <div className="thread" style={{ alignContent: "start", overflowY: "auto", maxHeight: "56vh" }}>
                {conv.summary && <div className="bubble bubble-note" dir="auto">Earlier: {conv.summary}</div>}
                {msgs.map((m) => m.status === "draft" ? (
                  <form key={m.id} action={sendDraft} className="bubble bubble-draft stack" style={{ gap: 8, width: "min(78%, 520px)" }}>
                    <input type="hidden" name="messageId" value={m.id} />
                    <span className="meta" style={{ color: "#000" }}>
                      Draft {m.kind === "private_reply" ? "private reply" : m.kind === "dm" ? "DM" : "public reply"}
                      {m.ai?.note ? `: ${m.ai.note}` : m.ai?.reason ? `: ${m.ai.reason}` : ""}
                    </span>
                    <textarea name="text" className="textarea" defaultValue={m.text} style={{ minHeight: 70, background: "#fff" }} dir="auto" />
                    <div className="row">
                      <button className="btn btn-sm" disabled={m.ai?.sending}>{m.ai?.sending ? "Sending…" : "Send"}</button>
                      <button formAction={discardDraft} className="btn btn-sm btn-line">Discard</button>
                    </div>
                  </form>
                ) : (
                  <div key={m.id} className={`bubble ${m.direction === "in" ? "bubble-in" : "bubble-out"}`} dir="auto">
                    {m.text}
                    <div className="bubble-meta">
                      <span>{ago(m.created_at)}</span>
                      {m.kind === "private_reply" && <span>private reply</span>}
                      {m.direction === "out" && m.route && <span>by {ROUTE[m.route] ?? m.route}</span>}
                      {m.direction === "in" && m.status === "failed" && <span style={{ color: "var(--tomato)" }}>failed: {m.ai?.error}</span>}
                      {m.direction === "in" && ["ignored", "hidden"].includes(m.status) && <span>{m.status} ({m.ai?.reason ?? ROUTE[m.route]})</span>}
                      {m.direction === "out" && m.ai?.cost ? <span>{m.ai.model}, {money(m.ai.cost)}{m.ai.cached ? `, ${Math.round((m.ai.cached / m.ai.input) * 100)}% cached` : ""}</span> : null}
                    </div>
                  </div>
                ))}
              </div>

              <form action={manualReply} className="row" style={{ padding: 14, borderTop: "1px solid var(--line)", flexWrap: "nowrap" }}>
                <input type="hidden" name="conversationId" value={conv.id} />
                <input name="text" className="input" placeholder={conv.channel === "dm" ? "Reply as you…" : "Reply publicly as you…"} dir="auto" autoComplete="off" />
                <button className="btn">Send</button>
              </form>
            </>
          )}
        </div>
      </div>
      <Toast message={t} />
    </section>
  );
}
