import Link from "next/link";
import { ArrowRight, BatteryHigh, CaretDown, CaretLeft, CellSignalFull, Heart, ShieldCheck, Translate, WifiHigh, EnvelopeSimpleOpen } from "@phosphor-icons/react/dist/ssr";
import { Art, type ArtName } from "@/components/Art";
import { MarketingNav } from "@/components/MarketingNav";

export const metadata = {
  title: "rply — the reply layer for brands that sell in the comments",
  description: "rply answers Facebook and Instagram comments and DMs in your voice, from your facts, in seconds. The ones that need a person land on your desk.",
};

function Capture({ dark = false, cta = "Start free" }: { dark?: boolean; cta?: string }) {
  return (
    <form action="/login" method="get" className="capture" style={dark ? { borderColor: "#fff" } : undefined}>
      <input type="hidden" name="mode" value="signup" />
      <label htmlFor={`cap-${cta}`} className="sr-only">Work email</label>
      <input id={`cap-${cta}`} name="email" type="email" placeholder="you@brand.com" autoComplete="email" style={{ color: "#000" }} />
      <button className="btn">{cta}<ArrowRight size={16} weight="bold" /></button>
    </form>
  );
}

/* A believable comments sheet: one orchestrated moment on page load (comment → typing → reply). */
function Phone() {
  const C = ({ av, user, text, time, t, brand, auto }: { av: string; user: string; text: string; time: string; t: number; brand?: boolean; auto?: boolean }) => (
    <div className={`cmt seq ${brand ? "reply" : ""}`} style={{ ["--t" as any]: `${t}s` }}>
      {brand ? <div className="cmt-av brand"><Art name="bub-head" size={30} className="" eager /></div>
             : <div className="cmt-av" style={{ background: av, color: "#fff", fontWeight: 700, fontSize: 13 }}>{user[0].toUpperCase()}</div>}
      <div>
        <div className="cmt-body"><b>{user}</b>{auto && <span className="pill-auto">rply</span>}<span className="cmt-text" dir="auto">{text}</span></div>
        <div className="cmt-meta"><span>{time}</span><span>Reply</span>{!brand && <Heart size={12} style={{ marginLeft: "auto" }} />}</div>
      </div>
    </div>
  );
  const Typing = ({ t, t2 }: { t: number; t2: number }) => (
    <div className="cmt reply seq-out" style={{ ["--t" as any]: `${t}s`, ["--t2" as any]: `${t2}s` }}>
      <div className="cmt-av brand"><Art name="bub-head" size={30} className="" eager /></div>
      <div className="typing" aria-hidden="true"><i /><i /><i /></div>
    </div>
  );
  return (
    <div className="phone" role="img" aria-label="Instagram-style comment thread where rply answers price and delivery questions in Egyptian Arabic within seconds">
      <div className="phone-screen">
        <div className="phone-island" />
        <div className="phone-status"><span>2:14</span><span className="row" style={{ gap: 5 }}><CellSignalFull size={15} weight="fill" /><WifiHigh size={15} weight="bold" /><BatteryHigh size={20} weight="fill" /></span></div>
        <div className="phone-bar"><CaretLeft size={20} weight="bold" /><span style={{ flex: 1, textAlign: "center", marginRight: 20 }}>Comments</span></div>
        <div className="phone-post">
          <div className="phone-thumb" style={{ background: "#dcff3a", overflow: "hidden" }}><Art name="at" size={44} className="" eager style={{ width: 44, height: 44, objectFit: "cover", marginTop: 6 }} /></div>
          <div style={{ fontSize: 13, lineHeight: 1.35 }}><b>threadandco.eg</b><span className="cmt-text" dir="auto">دروب الشتا نزل 🖤 هوديز أوفرسايز بـ ٥ ألوان</span><div className="cmt-meta">18m</div></div>
        </div>
        <div className="phone-feed">
          <C av="#c06cff" user="nour.designs" text="بكام الهودي الأسود؟ 😍" time="1m" t={0.4} />
          <Typing t={1.2} t2={2.5} />
          <C av="" user="threadandco.eg" text="بـ750 جنيه بس 🖤 بعتنالك المقاسات في الخاص" time="now" t={2.6} brand auto />
          <C av="#ff8a3d" user="omar_k" text="متاح XL؟ وبيوصل إسكندرية؟" time="now" t={3.5} />
          <Typing t={4.1} t2={5.3} />
          <C av="" user="threadandco.eg" text="متاح XL ✨ والشحن لإسكندرية من 4 لـ 6 أيام بـ85 جنيه" time="now" t={5.4} brand auto />
          <C av="#2bb3a6" user="sara.m" text="@mido_ali شوف ده 😂" time="now" t={6.3} />
        </div>
        <div className="phone-input"><Art name="bub-head" size={22} className="" eager />Add a comment for threadandco.eg…</div>
      </div>
    </div>
  );
}

const RUNGS: { art: ArtName; bg: string; title: string; body: string; cost: string; note: string }[] = [
  { art: "lens-head", bg: "#111", title: "Ghosts the noise", body: "Friend tags, emoji-only comments and spam are skipped or hidden before anything else runs.", cost: "$0", note: "no AI" },
  { art: "obj-bolt", bg: "#111", title: "Fires your instant replies", body: "Your rules for the questions you get a hundred times a day: price, branches, opening hours. أ/ا, ة/ه and «بكاااام» all match.", cost: "$0", note: "no AI" },
  { art: "obj-typing", bg: "#111", title: "Remembers what it already said", body: "Asked before on any page in the squad? It reuses the answer it gave, even when the wording is different.", cost: "≈ $0.000001", note: "one embedding" },
  { art: "obj-chip", bg: "#111", title: "Writes from your brain", body: "New questions get a reply written from your price list, FAQs and policies, in your voice. Your instructions are cached, so you pay for the new words only.", cost: "≈ $0.0001", note: "per AI reply" },
  { art: "bell-head", bg: "#111", title: "Hands you the hard ones", body: "Complaints, unknowns, anything it’s less than 60% sure about: drafted, never posted. You approve with one tap.", cost: "Your call", note: "human in the loop" },
];

const SQUAD_CARDS: { name: string; squad: string; art: ArtName; fill: string; pat: string; n: string }[] = [
  { name: "Thread & Co.", squad: "Streetwear", art: "at", fill: "#ff4a24", pat: "pat-grid", n: "1,284" },
  { name: "Smile Dental Maadi", squad: "Clinics", art: "phone", fill: "#7c5cff", pat: "pat-check", n: "642" },
  { name: "Fattah Burger", squad: "Food", art: "heart", fill: "#8ed3ff", pat: "pat-stripe", n: "2,107" },
  { name: "Nour Candles", squad: "Home", art: "plane", fill: "#dcff3a", pat: "pat-rings", n: "318" },
];

const FAQ = [
  ["Will Meta restrict my page for using this?", "rply only talks to Meta through the official Graph API, with permissions Meta grants through App Review. It follows Meta’s messaging rules: one private reply per comment within 7 days, DMs inside the 24-hour window, and per-account rate limits. No scraping, no browser automation."],
  ["Does it actually understand Egyptian Arabic?", "Before anything else runs, rply normalizes the spellings people really type (أ/ا, ى/ي, ة/ه, Arabic digits, stretched letters), so your rules and memory catch them. The AI then replies in the dialect you choose for each voice, or mirrors the customer: Egyptian, Gulf, Fusha, Franco or English."],
  ["What happens when it doesn’t know the answer?", "It doesn’t guess. If the answer isn’t in your brain, or it’s less than 60% sure, it writes a draft and moves the conversation to “Needs you”. Nothing is posted until you approve it."],
  ["Can I check replies before they go out?", "Yes. Every account has three modes: reply automatically, write drafts for you, or do nothing. You can switch any time, per account."],
  ["Do I need to confirm my email to start?", "No. Create a workspace with an email and a password and you’re in. Connecting your Pages happens through Facebook or Instagram login."],
  ["What does the AI cost to run?", "Most messages never reach the AI. The ones that do use a small model with cached instructions, about a hundredth of a cent each. The Usage page shows every cent, and a monthly cap keeps replies going on rules and memory if you hit it."],
];

export default function Landing() {
  return (
    <>
      <MarketingNav />

      {/* ───────── hero ───────── */}
      <section className="lhero">
        <div className="lhero-copy">
          <h1 className="display">Commerce moved into the comments.</h1>
          <p className="lede" style={{ textAlign: "center" }}>
            Your customers ask <bdi style={{ fontWeight: 700, color: "#000" }}>«بكام؟»</bdi> at 2 a.m., under a post, in a DM, across forty pages.
            rply answers every one in your voice, from your own facts, in seconds. The ones that need a person land on your desk.
          </p>
          <Capture />
          <div className="trust">
            <span><EnvelopeSimpleOpen size={16} />No confirmation email</span>
            <span><ShieldCheck size={16} />Official Meta API</span>
            <span><Translate size={16} />Egyptian, Gulf, Fusha, Franco, English</span>
          </div>
        </div>

        <div className="stagefloor">
          <Art name="heart" size={800} eager className="hero-char hero-char-l" />
          <Art name="bub" size={800} eager className="hero-char hero-char-r" />
          <div className="tile keep-sm" style={{ ["--s" as any]: "112px", ["--bg" as any]: "#000", left: "1.5%", top: "16%", ["--rot" as any]: "-8deg", ["--d" as any]: ".1s" }}><Art name="obj-bolt" size={100} className="" eager /></div>
          <div className="tile" style={{ ["--s" as any]: "96px", ["--bg" as any]: "#fff", left: "4%", top: "56%", ["--rot" as any]: "6deg", ["--d" as any]: ".25s" }}><Art name="obj-heart" size={90} className="" eager /></div>
          <div className="tile keep-sm" style={{ ["--s" as any]: "112px", ["--bg" as any]: "#7c5cff", right: "1.5%", top: "12%", ["--rot" as any]: "8deg", ["--d" as any]: ".15s" }}><Art name="obj-chip" size={100} className="" eager /></div>
          <div className="tile" style={{ ["--s" as any]: "96px", ["--bg" as any]: "#000", right: "4%", top: "54%", ["--rot" as any]: "-6deg", ["--d" as any]: ".3s" }}><Art name="obj-typing" size={88} className="" eager /></div>
          <Phone />
        </div>
      </section>

      {/* ───────── why ───────── */}
      <section className="deck sec" style={{ paddingTop: 140 }}>
        <div className="wrap">
          <p className="statement">A comment is the warmest lead you will ever get. <span className="dim">It is also the fastest to go cold.</span></p>
          <div className="facts">
            <div className="fact"><span className="num">7 days</span><p className="muted" style={{ margin: 0 }}>Meta’s window to send a private reply to a comment. One reply per comment, then the door closes.</p></div>
            <div className="fact"><span className="num">24 h</span><p className="muted" style={{ margin: 0 }}>How long a DM stays open for automated replies after the customer’s last message.</p></div>
            <div className="fact"><span className="num">1 inbox</span><p className="muted" style={{ margin: 0 }}>For every Page and Instagram account you run, instead of forty tabs and a WhatsApp group of moderators.</p></div>
          </div>
          <p className="lede" style={{ marginTop: 56, maxWidth: "62ch", fontSize: "clamp(17px,1.6vw,21px)", color: "#d6d6d0" }}>
            Hiring for it doesn’t scale. Generic bots make it worse. We built rply because the reply is the product: it’s the first thing a customer
            experiences of your brand, and most brands send it late, in the wrong tone, or not at all.
          </p>
        </div>
      </section>

      {/* ───────── how it thinks ───────── */}
      <section className="sec" id="how">
        <div className="sec-head">
          <h2 className="h2">It spends tokens like they’re its own.</h2>
          <p className="lede">Every message climbs the same five steps and stops at the first one that can answer it. Most never reach the AI.</p>
        </div>
        <ol className="ladder" style={{ listStyle: "none", padding: 0 }}>
          {RUNGS.map((r, i) => (
            <li key={r.title} className="rung">
              <span className="rung-n">{i + 1}</span>
              <span className="rung-art" style={{ background: r.bg }}><Art name={r.art} size={64} className="" /></span>
              <div><h3 className="h3">{r.title}</h3><p className="muted" style={{ margin: "6px 0 0", maxWidth: "62ch" }}>{r.body}</p></div>
              <div className="rung-cost">{r.cost}<small>{r.note}</small></div>
            </li>
          ))}
        </ol>
      </section>

      {/* ───────── squads ───────── */}
      <section className="deck sec" id="squads">
        <div className="wrap">
          <div className="spread" style={{ marginBottom: 14, flexWrap: "wrap", alignItems: "end" }}>
            <h2 className="h2" style={{ maxWidth: "14ch" }}>One brain for forty pages.</h2>
            <span className="dd">This week<CaretDown size={14} weight="bold" /></span>
          </div>
          <p className="lede" style={{ marginBottom: 36 }}>Group accounts into squads: a brand, a client, a chain of branches. They share one price list, one voice and one memory, so a question answered in Maadi is answered for free in Zayed.</p>
          <div className="grid-cards" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 42vw), 1fr))" }}>
            {SQUAD_CARDS.map((c) => (
              <div key={c.name} className="acard">
                <div className={`acard-art ${c.pat}`} style={{ background: c.fill }}>
                  <span className="badge">{c.squad}</span>
                  <Art name={c.art} size={256} className="char" />
                </div>
                <div className="acard-body">
                  <div className="acard-name">{c.name}</div>
                  <div className="meta">{c.n} replies this week</div>
                </div>
              </div>
            ))}
          </div>
          <p className="meta" style={{ marginTop: 18 }}>Example workspace. Every account in yours gets its own collectible.</p>
        </div>
      </section>

      {/* ───────── voice ───────── */}
      <section className="sec">
        <div className="sec-head" style={{ justifyItems: "center", textAlign: "center" }}>
          <h2 className="h2" style={{ maxWidth: "18ch" }}>Sounds like your best employee on their best day.</h2>
          <p className="lede">Tone, dialect, emoji, house rules, the call to action you want. Show it ten real replies from your page and it picks up the rest.</p>
        </div>
        <div className="versus">
          <div className="vcol vcol-bad">
            <span className="meta" style={{ color: "#55554f" }}>A generic bot</span>
            <div className="bubble bubble-in" dir="auto" style={{ maxWidth: "100%" }}>الهودي ده متاح XL؟ وبكام؟</div>
            <div className="bubble" style={{ background: "#fff", justifySelf: "end", maxWidth: "100%", border: "1.5px solid #ccc", color: "#55554f" }}>Thank you for your inquiry! Please contact our customer service team for pricing and availability information.</div>
          </div>
          <div className="vcol vcol-good">
            <span className="meta" style={{ color: "#dcff3a" }}>rply, in your voice</span>
            <div className="bubble" dir="auto" style={{ background: "#1b1b1b", maxWidth: "100%" }}>الهودي ده متاح XL؟ وبكام؟</div>
            <div className="bubble" dir="auto" style={{ background: "#dcff3a", color: "#000", justifySelf: "end", maxWidth: "100%" }}>متاح XL يا جميل 🖤 بـ750 جنيه والشحن لكل مصر. أبعتلك لينك الأوردر؟</div>
          </div>
        </div>
      </section>

      {/* ───────── faq ───────── */}
      <section className="sec" id="faq" style={{ paddingTop: 0 }}>
        <div className="sec-head" style={{ maxWidth: 900 }}><h2 className="h2">Questions brands ask first</h2></div>
        <div className="faq">
          {FAQ.map(([q, a]) => (<details key={q}><summary>{q}</summary><p>{a}</p></details>))}
        </div>
      </section>

      {/* ───────── close ───────── */}
      <section className="deck sec glow" style={{ textAlign: "center" }}>
        <div className="wrap" style={{ display: "grid", justifyItems: "center", gap: 24 }}>
          <Art name="lens" size={220} />
          <h2 className="display" style={{ fontSize: "clamp(40px, 7vw, 96px)" }}>Your next customer is typing.</h2>
          <p className="lede" style={{ textAlign: "center" }}>Connect a Page in two minutes. Teach it your prices in five. Watch the first reply go out.</p>
          <Capture dark cta="Create workspace" />
        </div>
      </section>

      <footer className="footer">
        <div className="footer-grid">
          <div className="stack"><span className="logo" style={{ color: "#fff" }}>rply</span><span className="meta">© {new Date().getFullYear()} rply. Made in Cairo.</span></div>
          <div className="stack"><strong>Product</strong><a href="#how">How it thinks</a><a href="#squads">Squads</a><a href="#faq">FAQ</a></div>
          <div className="stack"><strong>Company</strong><a href="/privacy">Privacy policy</a><a href="/privacy#deletion">Data deletion</a><Link href="/login">Log in</Link></div>
          <div className="stack" style={{ alignContent: "start" }}><strong>Start in two minutes</strong><Link href="/login?mode=signup" className="btn btn-lime" style={{ justifySelf: "start" }}>Create workspace</Link></div>
        </div>
        <div className="footer-word" aria-hidden="true">rply</div>
        <Art name="bub" size={800} className="art footer-peek" />
      </footer>
    </>
  );
}
