import { sql } from "../db";

export type Persona = {
  id: string | null; name: string; dialect: string; formality: number; emoji_level: number;
  max_chars: number; tone: string; rules: string; cta: string; examples: { in: string; out: string }[]; version: number;
};

export const DEFAULT_PERSONA: Persona = {
  id: null, name: "Default", dialect: "mirror", formality: 35, emoji_level: 1, max_chars: 280,
  tone: "warm, quick, helpful, sounds like a real person from the team", rules: "", cta: "", examples: [], version: 1,
};

export type AccountCtx = {
  id: string; workspace_id: string; squad_id: string | null; persona_id: string | null; platform: "facebook" | "instagram";
  connection: "facebook_login" | "instagram_login"; external_id: string; page_id: string | null; access_token_enc: string | null;
  name: string; username: string | null; status: string; reply_mode: "auto" | "draft" | "off"; settings: AccountSettings;
};

export type AccountSettings = {
  comments?: boolean;                 // auto-handle comments (default true)
  dms?: boolean;                      // auto-handle DMs (default true)
  comment_strategy?: "smart" | "public" | "private_first";
  public_ack?: string[];              // used with private_first
  noise?: "ignore" | "thanks";
  thanks_variants?: string[];
  hide_spam?: boolean;
  reply_delay_sec?: [number, number]; // human-ish delay window for comments
  smart_model?: boolean;              // allow escalation to the smart model
};

export type BrainCtx = {
  workspaceId: string; brainVersion: number; account: AccountCtx;
  squad: { id: string; name: string } | null; persona: Persona;
  scopeKey: string;                   // cache + prompt-cache partition
};

export async function loadContext(accountId: string): Promise<BrainCtx> {
  const [row] = await sql<any[]>`
    select a.*, w.brain_version, s.name as squad_name,
           coalesce(a.persona_id, s.persona_id) as effective_persona
    from accounts a
    join workspaces w on w.id = a.workspace_id
    left join squads s on s.id = a.squad_id
    where a.id = ${accountId}`;
  if (!row) throw new Error(`account ${accountId} not found`);

  let persona = DEFAULT_PERSONA;
  const [p] = row.effective_persona
    ? await sql<any[]>`select * from personas where id = ${row.effective_persona}`
    : await sql<any[]>`select * from personas where workspace_id = ${row.workspace_id} order by created_at limit 1`;
  if (p) persona = { ...p, examples: p.examples ?? [] };

  const account: AccountCtx = { ...row, settings: row.settings ?? {} };
  const squad = row.squad_id ? { id: row.squad_id, name: row.squad_name } : null;
  return {
    workspaceId: row.workspace_id,
    brainVersion: row.brain_version,
    account, squad, persona,
    // accounts in the same squad share one cache + one prompt prefix → better hit rates
    scopeKey: `${squad ? "s:" + squad.id : "a:" + account.id}:p${persona.id ?? "0"}.${persona.version}:b${row.brain_version}`,
  };
}

export async function bumpBrain(workspaceId: string) {
  await sql`update workspaces set brain_version = brain_version + 1 where id = ${workspaceId}`;
}
