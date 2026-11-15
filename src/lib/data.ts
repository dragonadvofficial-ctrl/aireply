import { sql } from "./db";

export type AccountRow = {
  id: string; name: string; username: string | null; platform: "facebook" | "instagram"; connection: string;
  status: string; reply_mode: string; squad_id: string | null; persona_id: string | null; settings: any;
  last_error: string | null; avatar_url: string | null; squad_name: string | null; replies_7d: number; pending: number;
};

export async function accounts(wid: string) {
  return sql<AccountRow[]>`
    select a.id, a.name, a.username, a.platform, a.connection, a.status, a.reply_mode, a.squad_id, a.persona_id, a.settings,
           a.last_error, a.avatar_url, s.name as squad_name,
           (select count(*)::int from messages m where m.account_id = a.id and m.direction = 'out' and m.status = 'sent' and m.created_at > now() - interval '7 days') as replies_7d,
           (select count(*)::int from conversations c where c.account_id = a.id and c.status = 'human') as pending
    from accounts a left join squads s on s.id = a.squad_id
    where a.workspace_id = ${wid}
    order by replies_7d desc, a.created_at`;
}

export async function squads(wid: string) {
  return sql<{ id: string; name: string; color: string; description: string; persona_id: string | null; persona_name: string | null; members: number }[]>`
    select s.*, p.name as persona_name, (select count(*)::int from accounts a where a.squad_id = s.id) as members
    from squads s left join personas p on p.id = s.persona_id where s.workspace_id = ${wid} order by s.created_at`;
}

export async function personas(wid: string) {
  return sql<any[]>`select * from personas where workspace_id = ${wid} order by created_at`;
}

export async function needsYou(wid: string) {
  const [r] = await sql<{ n: number }[]>`
    select count(*)::int n from conversations c join accounts a on a.id = c.account_id where a.workspace_id = ${wid} and c.status = 'human'`;
  return r?.n ?? 0;
}

export const COLORS: Record<string, string> = { lime: "#ddff3b", tomato: "#ff4a24", violet: "#8257ff", sky: "#8fd6ff", black: "#000000", white: "#ffffff" };

export function money(n: number) {
  return n === 0 ? "$0" : n < 0.0001 ? "<$0.0001" : n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
}
export function ago(d: Date | string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
