import type { CharName } from "./Art";

/** Collectible roster: every account gets one character + one card color, stable forever (hash of its id). */
export const ROSTER: CharName[] = ["bub", "heart", "plane", "bell", "at", "phone", "lens"];
export const FILLS = ["#ff4a24", "#7c5cff", "#dcff3a", "#8ed3ff", "#ffffff", "#18d26b", "#ffd84a", "#ff8fd1"];
export const PATTERNS = ["pat-grid", "pat-stripe", "pat-dots", "pat-check", "pat-rings"];

export function hash(s: string) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export function look(seed: string) {
  const h = hash(seed);
  return { char: ROSTER[h % ROSTER.length], fill: FILLS[(h >>> 5) % FILLS.length], pattern: PATTERNS[(h >>> 9) % PATTERNS.length] };
}
