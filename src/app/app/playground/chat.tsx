"use client";
import { useState } from "react";
import { Art } from "@/components/Art";

type Turn = { direction: "in" | "out"; text: string; meta?: any };
const ROUTE: Record<string, [string, string]> = {
  rule: ["Instant reply", "chip-tomato"], cache: ["From memory", "chip-violet"], llm: ["AI", "chip-lime"], skip: ["Not answered", "chip-black"],
};
const ACTION: Record<string, string> = { reply: "would reply", handoff: "would hand to you", ignore: "would skip it", hide: "would hide it" };

export function PlaygroundChat({ accounts }: { accounts: { id: string; name: string; platform: string }[] }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [channel, setChannel] = useState<"comment" | "dm">("comment");
  const [text, setText] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !accountId) return;
    setBusy(true); setError("");
    const history = channel === "dm" ? turns.filter((t) => t.text).map(({ direction, text }) => ({ direction, text })) : [];
    const mine: Turn = { direction: "in", text };
    setTurns((t) => (channel === "dm" ? [...t, mine] : [mine]));
    setText("");
    try {
      const r = await fetch("/api/playground", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accountId, channel, text: mine.text, history }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Request failed");
      const out: Turn[] = [{ direction: "out", text: d.reply ?? "", meta: d }];
      if (d.privateReply) out.push({ direction: "out", text: d.privateReply, meta: { ...d, private: true } });
      setTurns((t) => [...t, ...out]);
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  }

  if (!accounts.length) return <div className="panel empty"><span className="muted">Connect an account first. The playground uses that account’s brain and voice.</span></div>;

  return (
    <div className="split">
      <form onSubmit={send} className="panel panel-pad stack" style={{ gap: 18 }}>
        <label className="field"><span>Account</span>
          <select className="select" value={accountId} onChange={(e) => { setAccountId(e.target.value); setTurns([]); }}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.platform === "instagram" ? "IG" : "FB"})</option>)}
          </select>
        </label>
        <div className="field"><span>Send it as a</span>
          <div className="seg">
            {(["comment", "dm"] as const).map((c) => (
              <label key={c}><input type="radio" name="ch" checked={channel === c} onChange={() => { setChannel(c); setTurns([]); }} /><span>{c === "comment" ? "Comment" : "DM"}</span></label>
            ))}
          </div>
        </div>
        <label className="field"><span>Message</span>
          <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} dir="auto" placeholder="الهودي ده بكام ومتاح مقاس L؟" required
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(e as any); }} />
        </label>
        {error && <p role="alert" style={{ color: "var(--tomato)", fontWeight: 600, margin: 0 }}>{error}</p>}
        <div className="row">
          <button className="btn" disabled={busy}>{busy ? "Thinking…" : "Send as customer"}</button>
          {turns.length > 0 && <button type="button" className="btn btn-line" onClick={() => setTurns([])}>Start over</button>}
        </div>
        <p className="meta" style={{ margin: 0 }}>Try the same question twice with different wording: the second answer should come from memory and cost nothing.</p>
      </form>

      <div className="panel" style={{ minHeight: 360 }}>
        {turns.length === 0 ? <div className="empty"><Art name="bub" size={200} /><span className="muted">Replies show up here with how they were made and what they cost.</span></div> : (
          <div className="thread">
            {turns.map((t, i) => t.direction === "in" ? (
              <div key={i} className="bubble bubble-in" dir="auto">{t.text}</div>
            ) : (
              <div key={i} style={{ justifySelf: "end", display: "grid", gap: 6, justifyItems: "end", maxWidth: "min(80%, 520px)" }}>
                {t.text ? <div className={`bubble ${t.meta.action === "reply" ? "bubble-out" : "bubble-draft"}`} dir="auto" style={{ maxWidth: "100%" }}>{t.meta.private ? "✉︎ " : ""}{t.text}</div>
                        : <div className="bubble bubble-note">No reply text</div>}
                {!t.meta.private && (
                  <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                    <span className={`chip ${ROUTE[t.meta.route]?.[1] ?? ""}`}>{ROUTE[t.meta.route]?.[0] ?? t.meta.route}</span>
                    <span className="chip chip-line">{ACTION[t.meta.action] ?? t.meta.action}</span>
                    {t.meta.meta?.model && <span className="chip chip-line">{t.meta.meta.model}</span>}
                    {t.meta.meta?.input != null && <span className="chip chip-line">{t.meta.meta.input} in ({t.meta.meta.cached ?? 0} cached), {t.meta.meta.output} out</span>}
                    {t.meta.meta?.cost != null && <span className="chip chip-line">${Number(t.meta.meta.cost).toFixed(5)}</span>}
                    {t.meta.meta?.similarity != null && <span className="chip chip-line">{Math.round(t.meta.meta.similarity * 100)}% match</span>}
                    {t.meta.meta?.confidence != null && <span className="chip chip-line">{Math.round(t.meta.meta.confidence * 100)}% sure</span>}
                    {t.meta.meta?.reason && <span className="chip chip-line">{t.meta.meta.reason}</span>}
                    <span className="chip chip-line">{t.meta.meta?.ms} ms</span>
                  </div>
                )}
                {t.meta.meta?.note && !t.meta.private && <span className="meta" dir="auto">Note for your team: {t.meta.meta.note}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
