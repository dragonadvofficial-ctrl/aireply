import { test } from "node:test";
import assert from "node:assert/strict";
import { isNoise, isSpam, looksLikeComplaint, normalize, clampReply } from "../src/lib/ai/text";
import { chunk } from "../src/lib/ai/knowledge";
import { normalize as normalizeWebhook } from "../src/lib/meta/webhook";

test("arabic normalization makes spelling variants match", () => {
  assert.equal(normalize("عندكم مقاس ٣٨ فى الكارجو ؟"), normalize("عندكم مقاس 38 في الكارجو؟"));
  assert.equal(normalize("بكاااااام"), "بكاام");
  assert.equal(normalize("أسعار الإسكندرية"), normalize("اسعار الاسكندريه"));
});

test("noise and spam never reach the model", () => {
  for (const t of ["@ahmed.k @sara_m", "🔥🔥", "❤️❤️❤️", "تم", "  "]) assert.ok(isNoise(t), t);
  for (const t of ["بكام؟", "متاح مقاس L", "price please"]) assert.ok(!isNoise(t), t);
  assert.ok(isSpam("Earn $500 daily, DM me on whatsapp +201234567890"));
  assert.ok(isSpam("استثمار مضمون ربح يومي"));
  assert.ok(!isSpam("عندكم توصيل اسكندرية؟"));
  assert.ok(looksLikeComplaint("الأوردر متأخر ومحدش بيرد"));
});

test("clampReply cuts at a sentence boundary", () => {
  const r = clampReply("السعر 750 جنيه. متاح من S لـ XXL. والتوصيل يومين لكل المحافظات تقريبًا", 40);
  assert.ok(r.length <= 40 && r.endsWith("."));
});

test("chunker keeps FAQ pairs together", () => {
  const parts = chunk("Q: a?\nA: b\n\nQ: c?\nA: d", 350);
  assert.equal(parts.length, 1);
});

test("instagram comment + DM webhooks normalize, echoes are dropped", () => {
  const ev = normalizeWebhook({
    object: "instagram",
    entry: [{
      id: "IG1", time: 1,
      changes: [{ field: "comments", value: { id: "c1", text: "بكام", from: { id: "u1", username: "nour" }, media: { id: "m1" } } },
                { field: "comments", value: { id: "c2", text: "our reply", from: { id: "IG1", username: "brand" }, media: { id: "m1" } } }],
      messaging: [{ sender: { id: "u2" }, recipient: { id: "IG1" }, timestamp: 1700000000000, message: { mid: "mid1", text: "hi" } },
                  { sender: { id: "IG1" }, recipient: { id: "u2" }, timestamp: 1700000000001, message: { mid: "mid2", text: "echo", is_echo: true } }],
    }],
  });
  assert.equal(ev.length, 2);
  assert.deepEqual(ev.map((e) => e.kind).sort(), ["comment", "dm"]);
  assert.equal(ev.find((e) => e.kind === "comment")!.postId, "m1");
});
