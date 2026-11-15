// test helper: give the "Thread & Co." demo account a fake token and a known page id
import postgres from "postgres";
import { encrypt } from "../src/lib/crypto";
const sql = postgres(process.env.DATABASE_URL!);
await sql`update accounts set external_id = ${"PAGE_TEST"}, access_token_enc = ${encrypt("tok")}, status = ${"active"}, reply_mode = ${"auto"},
  settings = ${sql.json({ comment_strategy: "smart", noise: "ignore", hide_spam: true, reply_delay_sec: [0, 0] })} where name = ${"Thread & Co."}`;
await sql.end();
