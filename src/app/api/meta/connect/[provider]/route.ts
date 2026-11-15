import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { getSession, signToken } from "@/lib/auth";
import { facebookLoginUrl, instagramLoginUrl } from "@/lib/meta/oauth";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const s = await getSession();
  if (!s) redirect("/login");
  const { provider } = await params;
  const state = await signToken({ wid: s.wid, uid: s.uid, n: randomBytes(8).toString("hex") }, "15m");
  if (provider === "facebook") redirect(facebookLoginUrl(state));
  if (provider === "instagram") redirect(instagramLoginUrl(state));
  return new Response("unknown provider", { status: 404 });
}
