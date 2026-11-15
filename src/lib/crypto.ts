import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { env } from "./env";

function key(): Buffer {
  const raw = env.ENCRYPTION_KEY;
  if (!raw) throw new Error("Missing env: ENCRYPTION_KEY");
  const buf = Buffer.from(raw, raw.length === 64 ? "hex" : "base64");
  if (buf.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes (base64 or hex)");
  return buf;
}

/** AES-256-GCM → "v1.<iv>.<tag>.<ciphertext>" (base64url) */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

export function decrypt(blob: string): string {
  const [v, iv, tag, ct] = blob.split(".");
  if (v !== "v1") throw new Error("bad cipher version");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}

export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [alg, salt, hash] = stored.split("$");
  if (alg !== "scrypt") return false;
  const expected = Buffer.from(hash, "base64url");
  const got = scryptSync(pw, Buffer.from(salt, "base64url"), expected.length, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(expected, got);
}

export function hmacSha256Hex(secret: string, body: string | Buffer): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
