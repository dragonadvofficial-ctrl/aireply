import Link from "next/link";
import { FacebookLogo, InstagramLogo, X } from "@phosphor-icons/react/dist/ssr";
import { requireSession } from "@/lib/auth";
import { accounts, personas, squads } from "@/lib/data";
import { AccountArt } from "@/components/AccountArt";
import { Art } from "@/components/Art";
import { Switch } from "@/components/Switch";
import { Toast } from "@/components/Toast";
import { disconnectAccount, updateAccount } from "./actions";

export default async function Accounts({ searchParams }: { searchParams: Promise<{ a?: string; t?: string; added?: string; error?: string; q?: string; squad?: string }> }) {
  const s = await requireSession();
  const sp = await searchParams;
  const [list, sq, ps] = await Promise.all([accounts(s.wid), squads(s.wid), personas(s.wid)]);
  const sel = list.find((a) => a.id === sp.a);
  const q = (sp.q ?? "").trim().toLowerCase();
  const shown = list.filter((a) =>
    (!q || a.name.toLowerCase().includes(q) || (a.username ?? "").toLowerCase().includes(q)) &&
    (!sp.squad || (sp.squad === "none" ? !a.squad_id : a.squad_id === sp.squad)));
  const toast = sp.t ?? (sp.added ? `Connected ${sp.added} account${sp.added === "1" ? "" : "s"}` : undefined);

  return (
    <>
      <section className="stage">
        <div className="stage-head">
          <div>
            <h1 className="h2">Accounts</h1>
            <p className="lede">{list.length} connected. Put accounts in a squad so they share a brain and a voice.</p>
          </div>
        </div>
        {sp.error && <p role="alert" className="panel panel-pad" style={{ borderColor: "var(--tomato)", marginTop: 0 }}>Meta returned an error: {sp.error}</p>}

        <div id="connect" className="grid-cards" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          <a href="/api/meta/connect/facebook" className="panel panel-pad row" style={{ gap: 18, flexWrap: "nowrap" }}>
            <span className="tile static-tile" style={{ ["--s" as any]: "64px", ["--bg" as any]: "#2134ff", ["--fg" as any]: "#fff", borderRadius: 20 }}><FacebookLogo size={32} weight="fill" /></span>
            <span><strong className="h3">Log in with Facebook</strong><br /><span className="muted">Brings in every Page you manage, plus the Instagram accounts linked to them.</span></span>
          </a>
          <a href="/api/meta/connect/instagram" className="panel panel-pad row" style={{ gap: 18, flexWrap: "nowrap" }}>
            <span className="tile static-tile" style={{ ["--s" as any]: "64px", ["--bg" as any]: "#000", ["--fg" as any]: "#fff", borderRadius: 20 }}><InstagramLogo size={32} weight="bold" /></span>
            <span><strong className="h3">Log in with Instagram</strong><br /><span className="muted">For a professional Instagram account that isn’t linked to a Facebook Page.</span></span>
          </a>
        </div>
      </section>

      {sel && (
        <section className="stage" style={{ paddingTop: 0 }}>
          <form action={updateAccount} className="panel panel-pad stack" style={{ gap: 22 }}>
            <input type="hidden" name="id" value={sel.id} />
            <div className="spread">
              <div><h2 className="h3" dir="auto">{sel.name}</h2><span className="meta">{sel.platform === "instagram" ? "Instagram" : "Facebook Page"}{sel.username ? `, @${sel.username}` : ""}, connected via {sel.connection === "instagram_login" ? "Instagram" : "Facebook"}</span></div>
              <Link href="/app/accounts" className="btn btn-sm btn-line" aria-label="Close settings"><X size={16} /></Link>
            </div>
            {sel.last_error && <p className="chip chip-tomato" style={{ height: "auto", padding: "8px 12px", whiteSpace: "normal" }}>{sel.last_error}</p>}

            <div className="field">
              <span>When a message comes in</span>
              <div className="seg" role="radiogroup">
                {[["auto", "Reply automatically"], ["draft", "Write a draft for me"], ["off", "Do nothing"]].map(([v, l]) => (
                  <label key={v}><input type="radio" name="reply_mode" value={v} defaultChecked={sel.reply_mode === v} /><span>{l}</span></label>
                ))}
              </div>
            </div>

            <div className="form-grid">
              <label className="field"><span>Squad</span>
                <select name="squad_id" className="select" defaultValue={sel.squad_id ?? ""}>
                  <option value="">No squad</option>{sq.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </label>
              <label className="field"><span>Voice</span>
                <select name="persona_id" className="select" defaultValue={sel.persona_id ?? ""}>
                  <option value="">Use the squad’s voice</option>{ps.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label className="field"><span>Comments</span>
                <select name="comment_strategy" className="select" defaultValue={sel.settings?.comment_strategy ?? "smart"}>
                  <option value="smart">Reply in public, DM when details are private</option>
                  <option value="public">Public replies only</option>
                  <option value="private_first">Short public reply, details by DM</option>
                </select>
              </label>
              <div className="field"><span>Wait before replying to comments</span>
                <div className="row" style={{ flexWrap: "nowrap" }}>
                  <input className="input" name="delay_lo" type="number" min={0} max={600} defaultValue={sel.settings?.reply_delay_sec?.[0] ?? 4} aria-label="Minimum seconds" />
                  <span className="muted">to</span>
                  <input className="input" name="delay_hi" type="number" min={0} max={900} defaultValue={sel.settings?.reply_delay_sec?.[1] ?? 15} aria-label="Maximum seconds" />
                  <span className="muted">sec</span>
                </div>
              </div>
            </div>

            <div className="row" style={{ gap: 26 }}>
              <Switch name="comments" defaultChecked={sel.settings?.comments !== false} label="Answer comments" />
              <Switch name="dms" defaultChecked={sel.settings?.dms !== false} label="Answer DMs" />
              <Switch name="hide_spam" defaultChecked={sel.settings?.hide_spam !== false} label="Hide spam comments" />
              <Switch name="noise_thanks" defaultChecked={sel.settings?.noise === "thanks"} label="Heart emoji-only comments" />
              <Switch name="smart_model" defaultChecked={sel.settings?.smart_model !== false} label="Use the stronger model for complaints" />
              <Switch name="paused" defaultChecked={sel.status === "paused"} label="Pause this account" />
            </div>

            <label className="field"><span>Public replies for “details by DM”</span>
              <textarea name="public_ack" className="textarea" style={{ minHeight: 80 }} dir="auto"
                defaultValue={(sel.settings?.public_ack ?? []).join("\n")} placeholder={"بعتنالك التفاصيل في الرسايل ✉️\nشيّك على الرسايل 💌"} />
              <small>One per line. rply rotates them so the page doesn’t look like a bot.</small>
            </label>

            <div className="spread">
              <button className="btn">Save changes</button>
              <button formAction={disconnectAccount} className="btn btn-sm btn-danger">Disconnect</button>
            </div>
          </form>
        </section>
      )}

      <section className="deck">
        {list.length > 0 && (
          <form className="row" style={{ marginBottom: 24 }} role="search">
            <label className="sr-only" htmlFor="q">Search accounts</label>
            <input id="q" name="q" className="input" defaultValue={sp.q} placeholder="Search by name or @username" style={{ maxWidth: 320 }} dir="auto" />
            <label className="sr-only" htmlFor="squadf">Squad</label>
            <select id="squadf" name="squad" className="select" defaultValue={sp.squad ?? ""} style={{ maxWidth: 240 }}>
              <option value="">All squads</option><option value="none">Not in a squad</option>
              {sq.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <button className="btn btn-light">Filter</button>
            <span className="meta">{shown.length} of {list.length}</span>
          </form>
        )}
        {list.length === 0 ? <div className="empty"><Art name="phone" size={180} /><p className="muted" style={{ margin: 0 }}>Connected Pages and Instagram accounts show up here as collectibles.</p></div> : (
          <div className="grid-cards grid-dense">
            {shown.length === 0 && <p className="muted">No accounts match that search.</p>}
            {shown.map((a) => (
              <Link key={a.id} href={`/app/accounts?a=${a.id}`} className="acard" aria-current={a.id === sp.a ? "true" : undefined} style={a.id === sp.a ? { borderColor: "#ddff3b" } : undefined}>
                <AccountArt seed={a.id} platform={a.platform} status={a.status} label={a.squad_name ?? undefined} />
                <div className="acard-body">
                  <div className="acard-name" dir="auto">{a.name}</div>
                  <div className="row meta" style={{ justifyContent: "center", gap: 8 }}>
                    <span className={`dot ${a.status === "active" ? (a.reply_mode === "off" ? "dot-idle" : "dot-ok") : a.status === "paused" ? "dot-idle" : "dot-warn"}`} />
                    {a.status !== "active" ? a.status : a.reply_mode === "auto" ? "auto-reply" : a.reply_mode === "draft" ? "drafts only" : "off"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
      <Toast message={toast} />
    </>
  );
}
