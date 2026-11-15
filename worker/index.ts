/**
 * rply worker — run 1..N copies (`npm run worker`). Safe to scale horizontally:
 * jobs are claimed with FOR UPDATE SKIP LOCKED and one account is processed by one worker at a time.
 */
import "./boot";
import { hostname } from "node:os";
import { env } from "../src/lib/env";
import { sql } from "../src/lib/db";
import { claim, enqueue, prune, reapStale, type Job } from "../src/lib/queue";
import { executeJob } from "../src/lib/engine/run";

const ID = `${hostname()}:${process.pid}`;
let running = 0;
let stopping = false;

async function execute(job: Job) {
  running++;
  try { await executeJob(job, ID, log); } finally { running--; }
}

function log(what: string, job: Job, n: number, err?: string) {
  console.log(JSON.stringify({ t: new Date().toISOString(), w: ID, what, job: job.id, kind: job.kind, acct: job.account_id, n, err }));
}

async function loop() {
  let idle = 0;
  while (!stopping) {
    const free = env.WORKER_CONCURRENCY - running;
    if (free > 0) {
      const jobs = await claim(ID, free).catch((e) => { console.error("claim failed", e.message); return [] as Job[]; });
      for (const j of jobs) void execute(j);
      idle = jobs.length ? 0 : Math.min(idle + 1, 6);
    }
    await new Promise((r) => setTimeout(r, env.WORKER_POLL_MS * (1 + idle))); // back off when idle
  }
}

// housekeeping: stale locks every minute, token refresh daily, prune hourly
setInterval(() => reapStale().catch(() => {}), 60_000);
setInterval(() => prune().catch(() => {}), 3600_000);
setInterval(() => enqueue("refresh_tokens", {}, { dedupeKey: "refresh_tokens" }).catch(() => {}), 24 * 3600_000);
enqueue("refresh_tokens", {}, { dedupeKey: "refresh_tokens", delayMs: 30_000 }).catch(() => {});

async function shutdown() {
  stopping = true;
  console.log(`[${ID}] draining ${running} job(s)…`);
  const until = Date.now() + 25_000;
  while (running > 0 && Date.now() < until) await new Promise((r) => setTimeout(r, 200));
  await sql.end({ timeout: 5 });
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log(`[rply worker ${ID}] concurrency=${env.WORKER_CONCURRENCY}`);
loop();
