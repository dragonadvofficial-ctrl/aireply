"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { enqueue } from "@/lib/queue";
import { bumpBrain } from "@/lib/ai/context";
import { estimateTokens } from "@/lib/ai/text";

function parseScope(v: string): { scope: "workspace" | "squad" | "account"; scopeId: string | null } {
  const [scope, id] = v.split(":");
  return scope === "squad" || scope === "account" ? { scope, scopeId: id } : { scope: "workspace", scopeId: null };
}
const back = (scope: string, t: string) => redirect(`/app/brain?scope=${encodeURIComponent(scope)}&t=${encodeURIComponent(t)}`);

export async function addSource(form: FormData) {
  const s = await requireSession();
  const scopeRaw = String(form.get("scope") ?? "workspace");
  const { scope, scopeId } = parseScope(scopeRaw);
  const kind = String(form.get("kind") ?? "note");
  const title = String(form.get("title") ?? "").trim();
  const url = String(form.get("url") ?? "").trim();
  let content = String(form.get("content") ?? "").trim();
  const file = form.get("file");
  if (file && typeof file === "object" && "size" in file && file.size > 0) content = (await (file as File).text()).slice(0, 200_000);
  if (kind === "url" && !/^https?:\/\//.test(url)) return back(scopeRaw, "Add a full link starting with https://");
  if (kind !== "url" && !content) return back(scopeRaw, "Write something or attach a file first");

  const [src] = await sql<{ id: string }[]>`
    insert into knowledge_sources (workspace_id, scope, scope_id, kind, title, content, pinned, status, tokens, meta)
    values (${s.wid}, ${scope}, ${scopeId}, ${kind}, ${title || (kind === "url" ? url : content.slice(0, 40))}, ${kind === "url" ? "" : content},
            ${form.get("pinned") === "on"}, ${kind === "url" ? "pending" : "ready"}, ${estimateTokens(content)}, ${sql.json(kind === "url" ? { url } : {})})
    returning id`;
  await enqueue("ingest_source", { sourceId: src.id }, { maxAttempts: 3 });
  await bumpBrain(s.wid);
  revalidatePath("/app/brain");
  back(scopeRaw, kind === "url" ? "Reading the page…" : "Added to the brain");
}

export async function sourceAction(form: FormData) {
  const s = await requireSession();
  const id = String(form.get("id"));
  const op = String(form.get("op"));
  if (op === "delete") await sql`delete from knowledge_sources where id = ${id} and workspace_id = ${s.wid}`;
  if (op === "pin") await sql`update knowledge_sources set pinned = not pinned where id = ${id} and workspace_id = ${s.wid}`;
  await bumpBrain(s.wid);
  revalidatePath("/app/brain");
  back(String(form.get("scope")), op === "delete" ? "Removed" : "Updated");
}

export async function addQuickReply(form: FormData) {
  const s = await requireSession();
  const scopeRaw = String(form.get("scope") ?? "workspace");
  const { scope, scopeId } = parseScope(scopeRaw);
  const triggers = String(form.get("triggers") ?? "").split(/[,،\n]/).map((x) => x.trim()).filter(Boolean);
  const replies = String(form.get("replies") ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
  const privateReply = String(form.get("private_reply") ?? "").trim() || null;
  const instructions = String(form.get("instructions") ?? "").trim();
  const respond = form.get("respond") === "ai" ? "ai" : "fixed";
  const commentAction = ["public", "private", "both"].includes(String(form.get("comment_action"))) ? String(form.get("comment_action")) : "account";
  const match = ["contains", "all", "exact", "regex"].includes(String(form.get("match"))) ? String(form.get("match")) : "contains";

  if (!triggers.length) return back(scopeRaw, "Add at least one word or phrase");
  if (respond === "ai" && !instructions) return back(scopeRaw, "Tell the AI how to answer and what data to use");
  if (respond === "fixed") {
    if (!replies.length && !privateReply) return back(scopeRaw, "Write the reply text");
    if (commentAction === "public" && !replies.length) return back(scopeRaw, "Public-only rules need a public reply");
  }
  await sql`
    insert into quick_replies (workspace_id, scope, scope_id, name, triggers, match, channel, replies, private_reply, respond, instructions, comment_action)
    values (${s.wid}, ${scope}, ${scopeId}, ${String(form.get("name") || "").trim() || triggers[0]}, ${triggers}, ${match},
            ${String(form.get("channel") ?? "any")}, ${replies}, ${privateReply}, ${respond}, ${instructions}, ${commentAction})`;
  revalidatePath("/app/brain");
  back(scopeRaw, "Rule added");
}

export async function quickReplyAction(form: FormData) {
  const s = await requireSession();
  const id = String(form.get("id"));
  if (form.get("op") === "delete") await sql`delete from quick_replies where id = ${id} and workspace_id = ${s.wid}`;
  else await sql`update quick_replies set enabled = not enabled where id = ${id} and workspace_id = ${s.wid}`;
  revalidatePath("/app/brain");
  back(String(form.get("scope")), "Updated");
}
