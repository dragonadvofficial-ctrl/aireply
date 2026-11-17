import postgres from "postgres";
import { env } from "./env";

type Sql = ReturnType<typeof postgres>;
const g = globalThis as unknown as { __rplySql?: Sql };

/** One pool per process. The worker can point at a session-mode URL via WORKER_DATABASE_URL. */
export function createSql(url = env.DATABASE_URL, max = env.DB_POOL_MAX): Sql {
  return postgres(url, {
    max,
    prepare: env.DB_PREPARE,            // false for Supabase transaction pooler (pgbouncer)
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 60 * 5,
    keep_alive: 10,
    connection: { statement_timeout: 15000, idle_in_transaction_session_timeout: 15000 },
    transform: { undefined: null },
    onnotice: () => {},
  });
}

export const sql: Sql = g.__rplySql ?? (g.__rplySql = createSql(process.env.RPLY_ROLE === "worker" ? env.WORKER_DATABASE_URL : env.DATABASE_URL));

/** pgvector literal */
export const vec = (v: number[]) => `[${v.map((x) => +x.toFixed(6)).join(",")}]`;
