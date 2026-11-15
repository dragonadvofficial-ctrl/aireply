// Mock OpenAI (/v1/responses, /v1/embeddings) + Meta Graph for end-to-end tests.
import http from "node:http";
const log = [];
function embed(t) {
  const v = new Array(512).fill(0); const s = ` ${t.toLowerCase()} `;
  for (let i = 0; i < s.length - 2; i++) { let h = 0; for (const c of s.slice(i, i + 3)) h = (h * 31 + c.charCodeAt(0)) >>> 0; v[h % 512] += 1; }
  const n = Math.hypot(...v) || 1; return v.map((x) => x / n);
}
http.createServer(async (req, res) => {
  let body = ""; for await (const c of req) body += c;
  const j = body ? (() => { try { return JSON.parse(body); } catch { return {}; } })() : {};
  const send = (o) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  log.push({ m: req.method, u: req.url, b: j });
  if (req.url === "/__log") return send(log);
  if (req.url.startsWith("/v1/embeddings")) {
    const input = Array.isArray(j.input) ? j.input : [j.input];
    return send({ object: "list", model: j.model, data: input.map((t, i) => ({ object: "embedding", index: i, embedding: embed(t) })), usage: { prompt_tokens: 20, total_tokens: 20 } });
  }
  if (req.url.startsWith("/v1/responses")) {
    const dyn = j.input?.[1]?.content ?? ""; const staticLen = (j.input?.[0]?.content ?? "").length;
    const newMsg = dyn.split("NEW:\n").pop();
    const angry = /متأخر|late/.test(newMsg);
    const out = angry
      ? { action: "handoff", reply: "حقك علينا، ابعتلنا رقم الأوردر في الخاص", private_reply: "", intent: "complaint", sentiment: "negative", confidence: 0.4, cacheable: false, note: "needs order number" }
      : { action: "reply", reply: "الكارجو متاح من 30 لـ 38 🖤", private_reply: "الكارجو بـ690 جنيه، تحب لينك الأوردر؟", intent: "question", sentiment: "neutral", confidence: 0.92, cacheable: true, note: "" };
    return send({ id: "resp_1", object: "response", created_at: 1, status: "completed", model: j.model,
      output: [{ type: "message", id: "msg_1", status: "completed", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(out), annotations: [] }] }],
      usage: { input_tokens: Math.round(staticLen / 3) + 120, input_tokens_details: { cached_tokens: Math.round(staticLen / 3) }, output_tokens: 60, output_tokens_details: { reasoning_tokens: 0 }, total_tokens: 0 } });
  }
  if (req.url.includes("/me/messages")) return send({ recipient_id: "x", message_id: "mid." + Date.now() });
  if (/\/(comments|replies)\?/.test(req.url)) return send({ id: "reply_" + Date.now() });
  if (req.url.includes("hide=true") || req.url.includes("is_hidden=true")) return send({ success: true });
  res.writeHead(404); res.end("{}");
}).listen(4010, () => console.log("mock on 4010"));
