/**
 * Demo data for local development and screenshots. Never run against production.
 * Login: demo@rply.app / rplydemo123
 */
import postgres from "postgres";
import "../src/lib/load-env";
import { hashPassword } from "../src/lib/crypto";
import { estimateTokens, normalize } from "../src/lib/ai/text";

const sql = postgres(process.env.WORKER_DATABASE_URL || process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
if (process.env.NODE_ENV === "production") throw new Error("refusing to seed production");

const rnd = (a: number, b: number) => Math.floor(a + Math.random() * (b - a + 1));
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const ago = (min: number) => new Date(Date.now() - min * 60_000);

await sql`delete from workspaces where name = 'Wasla Agency'`;
await sql`delete from users where email = 'demo@rply.app'`;

const [ws] = await sql`insert into workspaces (name, monthly_budget_usd) values ('Wasla Agency', 25) returning id`;
const W = ws.id;
await sql`insert into users (workspace_id, email, name, password_hash) values (${W}, 'demo@rply.app', 'Mariam Adel', ${hashPassword("rplydemo123")})`;

const [house] = await sql`insert into personas (workspace_id, name, dialect, formality, emoji_level, max_chars, tone, rules, cta, examples) values
  (${W}, 'Big sister', 'eg', 25, 1, 220, 'Warm, quick, a little funny. Never pushy.',
   ${"Never promise an exact delivery date\nNo discounts unless BRAIN lists one\nCall customers يا جميل/ة only once per reply"},
   'اطلب من اللينك في البايو أو ابعتلنا رقمك في الخاص',
   ${sql.json([{ in: "بكام الهودي؟", out: "بـ750 جنيه بس 🖤 متاح من S لـ XXL" }, { in: "لسه موصلش الأوردر", out: "حقك علينا، ابعتلنا رقم الأوردر في الخاص وهنتابعه حالًا" }])}) returning id`;
const [clinic] = await sql`insert into personas (workspace_id, name, dialect, formality, emoji_level, max_chars, tone, rules) values
  (${W}, 'Clinic desk', 'mirror', 70, 0, 260, 'Calm, reassuring, precise.', ${"Never give medical advice\nAlways offer to book a consultation"}) returning id`;

const squadsData = [
  { name: "Thread & Co. streetwear", color: "lime", persona: house.id },
  { name: "Smile Dental branches", color: "sky", persona: clinic.id },
  { name: "Fattah Burger", color: "tomato", persona: house.id },
];
const sq: any[] = [];
for (const s of squadsData) sq.push((await sql`insert into squads (workspace_id, name, color, persona_id) values (${W}, ${s.name}, ${s.color}, ${s.persona}) returning id, name`)[0]);

const accs = [
  ["Thread & Co.", "facebook", 0], ["threadandco.eg", "instagram", 0], ["Thread & Co. Outlet", "facebook", 0], ["thread.outlet", "instagram", 0],
  ["Smile Dental Maadi", "facebook", 1], ["smile.maadi", "instagram", 1], ["Smile Dental Zayed", "facebook", 1], ["smile.zayed", "instagram", 1],
  ["Fattah Burger", "facebook", 2], ["fattahburger", "instagram", 2], ["فتّاح برجر الإسكندرية", "facebook", 2], ["Nour Candles", "instagram", -1],
] as const;
const A: any[] = [];
for (const [i, [name, platform, s]] of accs.entries()) {
  const [a] = await sql`insert into accounts (workspace_id, squad_id, platform, connection, external_id, name, username, status, reply_mode, settings)
    values (${W}, ${s >= 0 ? sq[s].id : null}, ${platform}, 'facebook_login', ${"demo_" + i + "_" + Date.now()}, ${name},
            ${platform === "instagram" ? name : null}, ${i === 7 ? "paused" : i === 10 ? "error" : "active"}, ${i === 11 ? "draft" : "auto"},
            ${sql.json({ comment_strategy: s === 0 ? "private_first" : "smart", noise: "thanks", hide_spam: true })})
    returning id, name, platform`;
  if (i === 10) await sql`update accounts set last_error = 'Token expired. Log in with Facebook again to reconnect.' where id = ${a.id}`;
  A.push(a);
}

const sources = [
  [null, "workspace", "note", "Agency policy", "We answer within business hours 10am–11pm Cairo time. Anything legal or medical goes to a human.", true],
  [sq[0].id, "squad", "product", "Price list FW26", "Oversized hoodie — 750 EGP — S to XXL — black, sand, olive\nCargo pants — 690 EGP — 30 to 38\nBoxy tee — 390 EGP — S to XL — 6 colors\nBeanie — 220 EGP — one size", true],
  [sq[0].id, "squad", "faq", "Delivery & returns", "Q: Delivery time?\nA: Cairo & Giza 2–3 days (60 EGP). Other governorates 4–6 days (85 EGP).\n\nQ: Cash on delivery?\nA: Yes, everywhere in Egypt.\n\nQ: Exchange?\nA: Within 14 days, tags on, unworn.", false],
  [sq[1].id, "squad", "faq", "Booking", "Q: How do I book?\nA: Send your name and phone in DM or call 0100 000 0000.\n\nQ: Consultation price?\nA: 300 EGP, deducted if you start treatment.", true],
  [sq[2].id, "squad", "product", "Menu", "Classic smash — 165 EGP\nDouble trouble — 235 EGP\nMushroom swiss — 210 EGP\nFries — 55 EGP\nDelivery through Talabat and our hotline 19XXX", true],
];
for (const [sid, scope, kind, title, content, pinned] of sources) {
  await sql`insert into knowledge_sources (workspace_id, scope, scope_id, kind, title, content, pinned, tokens)
            values (${W}, ${scope as string}, ${sid as any}, ${kind as string}, ${title as string}, ${content as string}, ${pinned as boolean}, ${estimateTokens(content as string)})`;
}
await sql`insert into quick_replies (workspace_id, scope, scope_id, name, triggers, replies, private_reply, channel, hits) values
  (${W}, 'squad', ${sq[0].id}, 'Price', ${["بكام", "السعر", "سعره", "price", "كام"]}, ${["بعتنالك الأسعار في الرسايل ❤️", "الأسعار عندك في الخاص ✨"]},
   'الهودي بـ750 جنيه والكارجو بـ690، المقاسات من S لـ XXL. تحب نبعتلك لينك الأوردر؟', 'comment', 412),
  (${W}, 'workspace', null, 'Location', ${["العنوان", "فين مكانكم", "location"]}, ${["كل الفروع في الخاص 📍"]}, null, 'any', 96),
  (${W}, 'squad', ${sq[2].id}, 'Open now', ${["فاتحين", "open"]}, ${["فاتحين من 12 الظهر لـ 2 بالليل 🍔"]}, null, 'any', 58)`;

// conversations
const people = ["Youssef Hany", "Salma Tarek", "Omar Nabil", "Nada Samir", "Karim Fawzy", "Habiba Ali", "Mostafa Reda", "Laila Hassan", "Ziad Emad", "Farida Mahmoud", "Ali Gamal", "Rana Adel"];
const lines: [string, string, string, string | null][] = [
  // text, route, status, reply
  ["بكام الهودي الأسود؟", "rule", "answered", "بعتنالك الأسعار في الرسايل ❤️"],
  ["عندكم مقاس XXL في الكارجو؟", "llm", "answered", "الكارجو متاح من 30 لـ 38 🖤 الـ 38 بيلبس XXL تقريبًا"],
  ["التوصيل للمنصورة بياخد قد ايه؟", "cache", "answered", "من 4 لـ 6 أيام والشحن بـ85 جنيه 🚚"],
  ["الأوردر بتاعي متأخر بقاله أسبوع ومحدش بيرد!!", "llm", "handoff", "حقك علينا جدًا، ابعتلنا رقم الأوردر في الخاص وهنتابعه حالًا"],
  ["@ahmed.k 😂😂", "rule", "ignored", null],
  ["حلو اوي 🔥", "rule", "answered", "نورتنا ❤️"],
  ["Earn $500 daily, DM me on whatsapp +201234567", "rule", "hidden", null],
  ["الكشف بكام؟", "cache", "answered", "الكشف بـ300 جنيه وبيتخصم لو بدأت العلاج. تحب نحجزلك؟"],
  ["عندي ألم في ضرس العقل اعمل ايه", "llm", "handoff", "سلامتك! الأفضل نحجزلك كشف عشان الدكتور يشوف. ابعتلنا اسمك ورقمك."],
  ["فاتحين دلوقتي؟", "rule", "answered", "فاتحين من 12 الظهر لـ 2 بالليل 🍔"],
  ["الدبل تروبل فيه صوص ايه؟", "llm", "answered", "فيه صوص فتّاح السري 😉 مايونيز مدخن وشطة خفيفة"],
  ["Do you ship to Dubai?", "llm", "handoff", "Not yet sadly! We only ship inside Egypt for now."],
];
let n = 0;
for (let i = 0; i < 46; i++) {
  const acct = A[i % A.length];
  const sqIdx = accs[i % A.length][2];
  const pool = lines.filter((_, j) => sqIdx === 0 ? j <= 7 && j !== 7 : sqIdx === 1 ? [7, 8, 4, 5, 6].includes(j) : [9, 10, 5, 4, 0].includes(j));
  const [text, route, status, reply] = pick(pool.length ? pool : lines);
  const who = people[i % people.length];
  const dm = i % 3 === 0;
  const minutes = rnd(2, 60 * 30);
  const [ct] = await sql`insert into contacts (account_id, external_id, name, last_inbound_at) values (${acct.id}, ${"u" + i}, ${who}, ${ago(minutes)})
                          on conflict (account_id, external_id) do update set name = excluded.name returning id`;
  const [cv] = await sql`insert into conversations (account_id, contact_id, channel, thread_ref, status, last_message_at, message_count)
                         values (${acct.id}, ${ct.id}, ${dm ? "dm" : "comment"}, ${dm ? "dm" : "post_" + (i % 5)}, ${status === "handoff" ? "human" : "bot"}, ${ago(minutes)}, 2)
                         returning id`;
  const ai = route === "llm" ? { model: status === "handoff" && text.includes("متأخر") ? "gpt-6.1-terra" : "gpt-6-luna", input: 2140, cached: 1920, output: 64, cost: 0.000086, confidence: status === "handoff" ? 0.45 : 0.91 }
           : route === "cache" ? { similarity: 0.96 } : { reason: status === "ignored" ? "noise" : status === "hidden" ? "spam" : "rule" };
  await sql`insert into messages (conversation_id, account_id, direction, kind, external_id, text, status, route, ai, created_at)
            values (${cv.id}, ${acct.id}, 'in', ${dm ? "dm" : "comment"}, ${"m" + i + Date.now()}, ${text}, ${status}, ${route}, ${sql.json(ai)}, ${ago(minutes)})`;
  if (reply) {
    await sql`insert into messages (conversation_id, account_id, direction, kind, text, status, route, ai, created_at)
              values (${cv.id}, ${acct.id}, 'out', ${dm ? "dm" : "reply"}, ${reply}, ${status === "handoff" ? "draft" : "sent"}, ${route},
                      ${sql.json({ ...ai, note: status === "handoff" ? (text.includes("متأخر") ? "Needs the order number to check status" : text.includes("Dubai") ? "Shipping outside Egypt isn’t in the brain" : "Medical question, a doctor should answer") : undefined })}, ${ago(minutes - 0.2)})`;
    n++;
  }
  if (route === "llm" || route === "cache") {
    await sql`insert into usage_events (workspace_id, account_id, kind, model, route, input_tokens, cached_tokens, output_tokens, cost_usd, created_at)
              values (${W}, ${acct.id}, ${route === "llm" ? "chat" : "embed"}, ${route === "llm" ? "gpt-6-luna" : "text-embedding-3-small"}, ${route},
                      ${route === "llm" ? 2140 : 18}, ${route === "llm" ? 1920 : 0}, ${route === "llm" ? 64 : 0}, ${route === "llm" ? 0.000086 : 0.00000036}, ${ago(minutes)})`;
  }
}
// spread historical usage over 14 days
for (let d = 0; d < 14; d++) for (let k = 0; k < rnd(40, 160); k++) {
  await sql`insert into usage_events (workspace_id, account_id, kind, model, route, input_tokens, cached_tokens, output_tokens, cost_usd, created_at)
            values (${W}, ${pick(A).id}, 'chat', 'gpt-6-luna', 'llm', 2200, 1950, 70, ${0.00009 + Math.random() * 0.00006}, ${ago(d * 1440 + rnd(0, 1300))})`;
}
await sql`insert into reply_cache (workspace_id, scope_key, question, question_norm, answer, hits) values (${W}, 'demo', 'التوصيل بكام', ${normalize("التوصيل بكام")}, ${JSON.stringify({ reply: "60 جنيه للقاهرة والجيزة" })}, 37)`;
console.log(`✓ seeded workspace ${W}: ${A.length} accounts, ${n} replies. Login demo@rply.app / rplydemo123`);
await sql.end();
