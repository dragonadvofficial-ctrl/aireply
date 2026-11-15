import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import "../src/lib/load-env";

const url = process.env.WORKER_DATABASE_URL || process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL missing");
const sql = postgres(url, { max: 1, onnotice: () => {} });
const dir = join(process.cwd(), "db/migrations");

await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
const done = new Set((await sql<{ name: string }[]>`select name from schema_migrations`).map((r) => r.name));
for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  if (done.has(f)) continue;
  console.log("→ applying", f);
  await sql.begin(async (tx) => {
    await tx.unsafe(readFileSync(join(dir, f), "utf8"));
    await tx`insert into schema_migrations (name) values (${f})`;
  });
}
console.log("✓ migrations up to date");
await sql.end();
