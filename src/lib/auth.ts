import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "./env";

const COOKIE = "rply_session";
export type Session = { uid: string; wid: string; email: string; name?: string | null };

const secret = () => {
  if (!env.SESSION_SECRET) throw new Error("Missing env: SESSION_SECRET");
  return new TextEncoder().encode(env.SESSION_SECRET);
};

export async function signToken(payload: Record<string, unknown>, ttl = "30d") {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(ttl).sign(secret());
}
export async function verifyToken<T>(token: string): Promise<T | null> {
  try { return (await jwtVerify(token, secret())).payload as T; } catch { return null; }
}

export async function createSession(s: Session) {
  const token = await signToken(s);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: env.APP_URL.startsWith("https"), path: "/", maxAge: 60 * 60 * 24 * 30,
  });
}
export async function destroySession() { (await cookies()).delete(COOKIE); }

export async function getSession(): Promise<Session | null> {
  const t = (await cookies()).get(COOKIE)?.value;
  return t ? verifyToken<Session>(t) : null;
}
export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}
