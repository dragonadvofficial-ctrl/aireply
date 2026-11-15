import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { accounts, COLORS, personas, squads } from "@/lib/data";
import { Art } from "@/components/Art";
import { look } from "@/components/characters";
import { Toast } from "@/components/Toast";
import { deleteSquad, saveSquad } from "./actions";

const SWATCHES = ["lime", "tomato", "violet", "sky", "white", "black"];

export default async function Squads({ searchParams }: { searchParams: Promise<{ s?: string; new?: string; t?: string }> }) {
  const sess = await requireSession();
  const sp = await searchParams;
  const [list, accts, ps] = await Promise.all([squads(sess.wid), accounts(sess.wid), personas(sess.wid)]);
  const sel = sp.new ? null : list.find((x) => x.id === sp.s);
  const editing = Boolean(sp.new) || Boolean(sel);

  return (
    <section className="stage">
      <div className="stage-head">
        <div>
          <h1 className="h2">Squads</h1>
          <p className="lede">A squad is a group of accounts that answer the same way: one brain, one voice. Use one per brand, per client, or per branch.</p>
        </div>
        <Link href="/app/squads?new=1" className="btn">New squad</Link>
      </div>

      <div className="split">
        <div className="grid-cards" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          {list.length === 0 && <div className="panel empty" style={{ gridColumn: "1 / -1" }}><Art name="plane" size={160} /><span className="muted">No squads yet. Make one and drop accounts into it.</span></div>}
          {list.map((x) => {
            const bg = COLORS[x.color] ?? COLORS.lime;
            const dark = x.color === "black" || x.color === "violet" || x.color === "tomato";
            return (
              <Link key={x.id} href={`/app/squads?s=${x.id}`} className="pat-dots" style={{ background: bg, color: dark ? "#fff" : "#000", borderRadius: "var(--r-tile)", padding: 18, display: "grid", gap: 6, minHeight: 210, alignContent: "space-between", boxShadow: x.id === sp.s ? "0 0 0 3px #000" : "var(--lift)" }}>
                <Art name={look(x.id).char} size={130} style={{ margin: "-10px 0 -6px -10px" }} />
                <span style={{ display: "grid", gap: 6 }}><strong className="h3" dir="auto">{x.name}</strong>
                <span style={{ fontStretch: "80%", fontSize: 13, opacity: 0.8 }}>{x.members} account{x.members === 1 ? "" : "s"}, voice: {x.persona_name ?? "workspace default"}</span></span>
              </Link>
            );
          })}
        </div>

        {editing ? (
          <form action={saveSquad} className="panel panel-pad stack" style={{ gap: 18 }}>
            {sel && <input type="hidden" name="id" value={sel.id} />}
            <h2 className="h3">{sel ? `Edit ${sel.name}` : "New squad"}</h2>
            <label className="field"><span>Name</span><input name="name" className="input" defaultValue={sel?.name ?? ""} placeholder="Cairo branches" required dir="auto" /></label>
            <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ fontWeight: 620, fontSize: 13.5, marginBottom: 7 }}>Color</legend>
              <div className="row">
                {SWATCHES.map((c) => (
                  <label key={c} title={c} style={{ cursor: "pointer" }}>
                    <input type="radio" name="color" value={c} defaultChecked={(sel?.color ?? "lime") === c} className="sr-only" />
                    <span style={{ display: "block", width: 34, height: 34, borderRadius: 11, background: COLORS[c], border: "1.5px solid #000" }} />
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="field"><span>Voice</span>
              <select name="persona_id" className="select" defaultValue={sel?.persona_id ?? ""}>
                <option value="">Workspace default</option>{ps.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="field"><span>Notes for your team</span><textarea name="description" className="textarea" style={{ minHeight: 70 }} defaultValue={sel?.description ?? ""} dir="auto" /></label>
            <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ fontWeight: 620, fontSize: 13.5, marginBottom: 7 }}>Accounts in this squad</legend>
              <div className="panel" style={{ maxHeight: 260, overflowY: "auto", borderWidth: 1 }}>
                {accts.length === 0 && <p className="muted" style={{ padding: 14, margin: 0 }}>Connect accounts first.</p>}
                {accts.map((a) => (
                  <label key={a.id} className="list-row" style={{ alignItems: "center", cursor: "pointer", borderTop: "1px solid var(--line)" }}>
                    <input type="checkbox" name="members" value={a.id} defaultChecked={sel ? a.squad_id === sel.id : false} style={{ width: 18, height: 18, accentColor: "#000" }} />
                    <span dir="auto" style={{ flex: 1 }}>{a.name}</span>
                    <span className="meta">{a.platform === "instagram" ? "IG" : "FB"}{a.squad_name && a.squad_id !== sel?.id ? `, in ${a.squad_name}` : ""}</span>
                  </label>
                ))}
              </div>
              <small>Checking an account that’s already in another squad moves it here.</small>
            </fieldset>
            <div className="spread">
              <button className="btn">{sel ? "Save squad" : "Create squad"}</button>
              {sel && <button formAction={deleteSquad} className="btn btn-sm btn-danger">Delete squad</button>}
            </div>
          </form>
        ) : (
          <div className="panel panel-pad stack">
            <h2 className="h3">How squads share knowledge</h2>
            <p className="muted" style={{ margin: 0 }}>Each account reads three layers of the brain: things every account should know, things its squad knows, and things only it knows. The closer layer wins when they disagree.</p>
            <p className="muted" style={{ margin: 0 }}>Accounts in the same squad also share reply memory, so a question answered on one page is answered for free on the others.</p>
          </div>
        )}
      </div>
      <Toast message={sp.t} />
    </section>
  );
}
