// Zero-token text helpers. Everything here runs before any model is called.

const TASHKEEL = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;

/** Arabic-aware normalization for matching & cache keys (not for display). */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(TASHKEEL, "")
    .replace(/ـ/g, "")                 // tatweel
    .replace(/[إأآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/@[\w.]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/(.)\1{2,}/gu, "$1$1")          // "بكاااام" → "بكاام"
    .replace(/\s+/g, " ")
    .trim();
}

const EMOJI_ONLY = /^[\p{Extended_Pictographic}\p{Emoji_Component}\s‍️!?.؟،,]+$/u;
const FILLER = new Set(["تم", "done", "ok", "اوك", "👍", "شكرا", "thanks", "nice", "حلو", "جميل", "واو", "wow", "تحفه", "روعه", "❤", "up", "اب", "متابعه"]);

/** Tags-only, emoji-only, one-word praise… → no AI needed. */
export function isNoise(raw: string): boolean {
  const t = raw.trim();
  if (!t) return true;
  if (EMOJI_ONLY.test(t)) return true;
  const withoutMentions = t.replace(/@[\w.]+/g, "").trim();
  if (!withoutMentions) return true;                       // friend tagging
  const n = normalize(t);
  if (n.length <= 1) return true;
  return FILLER.has(n);
}

const SPAM = [/whats?app\s*[:+]?\s*\+?\d{6,}/i, /\b(crypto|bitcoin|forex|investment|earn \$\d+)\b/i, /(تمويل|قروض|استثمار مضمون|ربح يومي|اربح)/, /t\.me\//i, /bit\.ly\//i];
export function isSpam(raw: string): boolean {
  return SPAM.some((r) => r.test(raw));
}

const COMPLAINT = /(مشكل|نصب|حرامي|اتأخر|متأخر|مجاش|ماوصلش|موصلش|بايظ|بايز|مكسور|استرجاع|استرداد|فلوسي|زفت|وحش|اسوأ|سيء|refund|scam|broken|late|worst|complaint|never arrived)/i;
export const looksLikeComplaint = (s: string) => COMPLAINT.test(s);

/** Rough token estimate (Arabic ~2.6 chars/token, Latin ~4). Good enough for budgeting. */
export function estimateTokens(s: string): number {
  const arabic = (s.match(/[؀-ۿ]/g) ?? []).length;
  return Math.ceil(arabic / 2.6 + (s.length - arabic) / 4);
}

export function pick<T>(arr: T[], seed = Math.random()): T {
  return arr[Math.floor(seed * arr.length) % arr.length];
}

export function clampReply(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const stop = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("!"), cut.lastIndexOf("؟"), cut.lastIndexOf("?"), cut.lastIndexOf("\n"));
  return (stop > max * 0.5 ? cut.slice(0, stop + 1) : cut).trim();
}
