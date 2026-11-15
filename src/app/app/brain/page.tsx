import { PushPin, Trash } from "@phosphor-icons/react/dist/ssr";
import { requireSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { env } from "@/lib/env";
import { accounts, squads } from "@/lib/data";
import { Switch } from "@/components/Switch";
import { Art } from "@/components/Art";
import { Toast } from "@/components/Toast";
import { addQuickReply, addSource, quickReplyAction, sourceAction } from "./actions";

const KINDS = [["note", "Note"], ["faq", "FAQ"], ["product", "Price list"], ["url", "Web page"], ["file", "File"]] as const;
const PLACEHOLDER: Record<string, string> = {
  note: "Delivery: Cairo & Giza 2–3 days (60 EGP). Other governorates 4–6 days (85 EGP).\nWe open 11am–11pm, Friday from 2pm.",
  faq: "Q: Do you have cash on delivery?\nA: Yes, everywhere in Egypt.\n\nQ: Can I exchange?\nA: Within 14 days with the tag on.",
  product: "Oversized hoodie — 750 EGP — sizes S to XXL — black, sand, olive\nCargo pants — 690 EGP — sizes 30 to 38",
};

export default async function Brain({ searchParams }: { searchParams: Promise<{ scope?: string; kind?: string; t?: string }> }) {
  const s = await requireSession();
  const sp = await searchParams;
  const scope = sp.scope ?? "workspace";
  const kind = sp.kind ?? "note";
  const [sType, sId] = scope.split(":");
  const [sq, accts] = await Promise.all([squads(s.wid), accounts(s.wid)]);

  const filter = sType === "workspace" ? sql`scope = 'workspace'` : sql`scope = ${sType} and scope_id = ${sId}`;
  const [sources, rules, [size]] = await Promise.all([
    sql<any[]>`select * from knowledge_sources where workspace_id = ${s.wid} and ${filter} order by pinned desc, created_at desc`,
    sql<any[]>`select * from quick_replies where workspace_id = ${s.wid} and ${filter} order by created_at desc`,
    sql<{ total: number }[]>`select coalesce(sum(tokens),0)::int total from knowledge_sources where workspace_id = ${s.wid} and ${filter}`,
  ]);
  const scopeName = sType === "workspace" ? "Every account" : sType === "squad" ? sq.find((x) => x.id === sId)?.name : accts.find((x) => x.id === sId)?.name;
  const stuffed = size.total <= env.AI_STUFF_KNOWLEDGE_TOKENS;

  return (
    <section className="stage">
      <div className="stage-head">
        <div>
          <h1 className="h2">Brain</h1>
          <p className="lede">The facts rply is allowed to use. If something isn’t here, it won’t guess. It hands the question to you.</p>
        </div>
        <form className="row" style={{ flexWrap: "nowrap" }}>
          <label className="sr-only" htmlFor="scope">Whose brain</label>
          <select id="scope" name="scope" className="select" defaultValue={scope} style={{ minWidth: 240 }}>
            <option value="workspace">Every account</option>
            {sq.length > 0 && <optgroup label="Squads">{sq.map((x) => <option key={x.id} value={`squad:${x.id}`}>{x.name}</option>)}</optgroup>}
            {accts.length > 0 && <optgroup label="Single accounts">{accts.map((x) => <option key={x.id} value={`account:${x.id}`}>{x.name}</option>)}</optgroup>}
          </select>
          <button className="btn">Show</button>
        </form>
      </div>

      <div className="split">
        <div className="stack" style={{ gap: 22 }}>
          <div className="panel">
            <div className="spread panel-pad" style={{ paddingBottom: 12 }}>
              <h2 className="h3" dir="auto">{scopeName}</h2>
              <span className={`chip ${stuffed ? "chip-lime" : "chip-sky"}`} title={stuffed ? "Small enough to send whole, from the model's prompt cache" : "Large: rply searches it and sends only the relevant parts"}>
                {size.total.toLocaleString()} tokens, {stuffed ? "sent whole (cached)" : "searched per message"}
              </span>
            </div>
            <ul className="list">
              {sources.length === 0 && <li className="empty"><Art name="obj-chip" size={120} /><span className="muted">Nothing here yet. Start with your prices, delivery and returns. That covers most questions.</span></li>}
              {sources.map((x) => (
                <li key={x.id} className="list-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <strong dir="auto">{x.title}</strong>
                      <span className="chip">{KINDS.find(([k]) => k === x.kind)?.[1] ?? x.kind}</span>
                      {x.pinned && <span className="chip chip-black">always included</span>}
                      {x.status !== "ready" && <span className={`chip ${x.status === "error" ? "chip-tomato" : ""}`}>{x.status === "pending" ? "reading…" : "failed"}</span>}
                    </div>
                    <p dir="auto" className="muted" style={{ margin: "6px 0 0", textAlign: "left", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{x.content || x.meta?.url}</p>
                  </div>
                  <form action={sourceAction} className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                    <input type="hidden" name="id" value={x.id} /><input type="hidden" name="scope" value={scope} />
                    <button name="op" value="pin" className="btn btn-sm btn-line" title={x.pinned ? "Stop always including" : "Always include"} aria-label="Toggle always include"><PushPin size={16} weight={x.pinned ? "fill" : "regular"} /></button>
                    <button name="op" value="delete" className="btn btn-sm btn-line" aria-label="Remove"><Trash size={16} /></button>
                  </form>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel">
            <div className="panel-pad" style={{ paddingBottom: 8 }}>
              <h2 className="h3">Instant replies</h2>
              <p className="muted" style={{ margin: "6px 0 0" }}>When a message contains a trigger, rply sends one of these replies right away. No AI involved.</p>
            </div>
            <ul className="list">
              {rules.map((r) => (
                <li key={r.id} className="list-row">
                  <div style={{ flex: 1, minWidth: 0, opacity: r.enabled ? 1 : 0.5 }}>
                    <div className="row" style={{ gap: 6 }}>{r.triggers.map((t: string) => <span key={t} className="chip chip-tomato" dir="auto">{t}</span>)}<span className="meta">{r.match}, {r.channel === "any" ? "comments and DMs" : r.channel + "s"}, used {r.hits}×</span></div>
                    <p dir="auto" style={{ margin: "6px 0 0", textAlign: "left" }}>{r.replies[0]}{r.replies.length > 1 ? <span className="meta"> +{r.replies.length - 1} more</span> : null}</p>
                  </div>
                  <form action={quickReplyAction} className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                    <input type="hidden" name="id" value={r.id} /><input type="hidden" name="scope" value={scope} />
                    <button name="op" value="toggle" className="btn btn-sm btn-line">{r.enabled ? "Turn off" : "Turn on"}</button>
                    <button name="op" value="delete" className="btn btn-sm btn-line" aria-label="Delete rule"><Trash size={16} /></button>
                  </form>
                </li>
              ))}
            </ul>
            <details style={{ borderTop: "1px solid var(--line)" }}>
              <summary className="panel-pad" style={{ fontWeight: 650 }}>Add an instant reply</summary>
              <form action={addQuickReply} className="stack" style={{ padding: "0 22px 22px" }}>
                <input type="hidden" name="scope" value={scope} />
                <label className="field"><span>Triggers</span><input name="triggers" className="input" placeholder="بكام, السعر, price, كام" dir="auto" required /><small>Separate with commas. Spelling variants are matched for you (أ/ا, ة/ه, stretched letters).</small></label>
                <div className="form-grid">
                  <label className="field"><span>Match</span><select name="match" className="select"><option value="contains">Message contains a trigger</option><option value="exact">Message is exactly a trigger</option><option value="regex">Regular expression</option></select></label>
                  <label className="field"><span>Where</span><select name="channel" className="select"><option value="any">Comments and DMs</option><option value="comment">Comments only</option><option value="dm">DMs only</option></select></label>
                </div>
                <label className="field"><span>Replies</span><textarea name="replies" className="textarea" style={{ minHeight: 80 }} dir="auto" placeholder={"بعتنالك الأسعار في الرسايل ❤️\nالأسعار عندك في الخاص ✨"} required /><small>One per line. rply rotates them.</small></label>
                <label className="field"><span>Private reply (comments only, optional)</span><textarea name="private_reply" className="textarea" style={{ minHeight: 70 }} dir="auto" placeholder="الهودي بـ750 جنيه والكارجو بـ690، المقاسات من S لـ XXL" /></label>
                <button className="btn">Add instant reply</button>
              </form>
            </details>
          </div>
        </div>

        <form action={addSource} className="panel panel-pad stack" style={{ gap: 16, position: "sticky", top: 90 }} encType="multipart/form-data">
          <h2 className="h3">Teach it something</h2>
          <input type="hidden" name="scope" value={scope} />
          <nav className="tabs" aria-label="Type">
            {KINDS.map(([k, l]) => <a key={k} className="tab" href={`/app/brain?scope=${encodeURIComponent(scope)}&kind=${k}`} aria-current={kind === k ? "page" : undefined}>{l}</a>)}
          </nav>
          <input type="hidden" name="kind" value={kind === "file" ? "note" : kind} />
          <label className="field"><span>Title</span><input name="title" className="input" placeholder={kind === "faq" ? "Shipping questions" : "Delivery & returns"} dir="auto" /></label>
          {kind === "url" ? (
            <label className="field"><span>Link</span><input name="url" type="url" className="input" placeholder="https://yourstore.com/shipping" required /><small>rply reads the page text once. Add it again if the page changes.</small></label>
          ) : kind === "file" ? (
            <label className="field"><span>File</span><input name="file" type="file" accept=".txt,.md,.csv,.json" className="input" style={{ paddingTop: 10 }} required /><small>Plain text, Markdown, CSV or JSON.</small></label>
          ) : (
            <label className="field"><span>{kind === "faq" ? "Questions and answers" : kind === "product" ? "One product per line" : "Text"}</span>
              <textarea name="content" className="textarea" style={{ minHeight: 200 }} dir="auto" placeholder={PLACEHOLDER[kind]} required />
            </label>
          )}
          <Switch name="pinned" label="Always include (use for prices and anything critical)" />
          <button className="btn">Add to brain</button>
        </form>
      </div>
      <Toast message={sp.t} />
    </section>
  );
}
