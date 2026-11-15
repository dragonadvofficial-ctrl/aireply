import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { personas } from "@/lib/data";
import { Art, type ArtName } from "@/components/Art";
import { Toast } from "@/components/Toast";
import { deletePersona, savePersona } from "./actions";

const DIALECTS = [["mirror", "Match the customer"], ["eg", "Egyptian Arabic"], ["msa", "Simple Fusha"], ["gulf", "Gulf Arabic"], ["franco", "Franco (3arabizi)"], ["en", "English"]];
const FACES: ArtName[] = ["bub-head", "heart-head", "plane-head", "bell-head", "at-head", "phone-head", "lens-head"];

export default async function Voice({ searchParams }: { searchParams: Promise<{ p?: string; new?: string; t?: string }> }) {
  const s = await requireSession();
  const sp = await searchParams;
  const list = await personas(s.wid);
  const p = sp.new ? null : list.find((x) => x.id === sp.p) ?? list[0] ?? null;
  const examples = (p?.examples ?? []).map((e: any) => `${e.in} => ${e.out}`).join("\n");

  return (
    <section className="stage">
      <div className="stage-head">
        <div>
          <h1 className="h2">Voice</h1>
          <p className="lede">How replies sound. Give each squad its own voice, or override it on a single account.</p>
        </div>
        <Link href="/app/voice?new=1" className="btn">New voice</Link>
      </div>

      <div className="split" style={{ gridTemplateColumns: "minmax(0, 300px) minmax(0, 1fr)" }}>
        <ul className="list panel">
          {list.map((x, i) => (
            <li key={x.id}>
              <Link href={`/app/voice?p=${x.id}`} className="list-row" style={{ alignItems: "center" }} aria-current={x.id === p?.id ? "true" : undefined}>
                <Art name={FACES[i % FACES.length]} size={52} className="" />
                <div><strong dir="auto">{x.name}</strong><div className="meta">{DIALECTS.find(([k]) => k === x.dialect)?.[1]}, version {x.version}</div></div>
              </Link>
            </li>
          ))}
          {list.length === 0 && <li className="empty"><span className="muted">No voices yet.</span></li>}
        </ul>

        <form action={savePersona} className="panel panel-pad stack" style={{ gap: 20 }}>
          {p && <input type="hidden" name="id" value={p.id} />}
          <div className="form-grid">
            <label className="field"><span>Name</span><input name="name" className="input" defaultValue={p?.name ?? ""} placeholder="Big sister energy" required dir="auto" /></label>
            <label className="field"><span>Language</span>
              <select name="dialect" className="select" defaultValue={p?.dialect ?? "mirror"}>{DIALECTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            </label>
            <label className="field"><span>Longest reply</span><input name="max_chars" type="number" min={60} max={1000} className="input" defaultValue={p?.max_chars ?? 280} /><small>Characters. Comments read best under 200.</small></label>
          </div>

          <div className="form-grid">
            <label className="field"><span>How formal</span>
              <input type="range" name="formality" min={0} max={100} step={5} defaultValue={p?.formality ?? 35} className="range" />
              <span className="spread meta"><span>texting a friend</span><span>customer service desk</span></span>
            </label>
            <div className="field"><span>Emojis</span>
              <div className="seg">{["None", "One", "Some", "Lots"].map((l, i) => (
                <label key={l}><input type="radio" name="emoji_level" value={i} defaultChecked={(p?.emoji_level ?? 1) === i} /><span>{l}</span></label>
              ))}</div>
            </div>
          </div>

          <label className="field"><span>Personality</span><input name="tone" className="input" defaultValue={p?.tone ?? ""} dir="auto" placeholder="Warm, quick, a bit funny. Never pushy. Calls customers يا جميل/ة." /></label>
          <label className="field"><span>House rules</span>
            <textarea name="rules" className="textarea" defaultValue={p?.rules ?? ""} dir="auto" placeholder={"Never promise a delivery date\nDon’t mention competitors\nIf they ask for a discount, offer free shipping over 1,500 EGP"} />
            <small>One rule per line.</small>
          </label>
          <label className="field"><span>Call to action</span><input name="cta" className="input" defaultValue={p?.cta ?? ""} dir="auto" placeholder="اطلب من اللينك في البايو أو ابعتلنا رقمك في الخاص" /><small>rply adds it only when it helps the customer take the next step.</small></label>
          <label className="field"><span>Example replies</span>
            <textarea name="examples" className="textarea" style={{ minHeight: 150 }} defaultValue={examples} dir="auto"
              placeholder={"بكام الهودي؟ => بـ750 جنيه بس 🖤 متاح من S لـ XXL\nلسه موصلش الأوردر => حقك علينا، ابعتلنا رقم الأوردر في الخاص وهنتابعه حالًا"} />
            <small>One per line: what the customer wrote =&gt; what you’d answer. Real replies from your page work best.</small>
          </label>
          <div className="spread">
            <button className="btn">{p ? "Save voice" : "Create voice"}</button>
            {p && list.length > 1 && <button formAction={deletePersona} className="btn btn-sm btn-danger">Delete</button>}
          </div>
        </form>
      </div>
      <Toast message={sp.t} />
    </section>
  );
}
