/**
 * rply worker — run 1..N copies (`npm run worker`). Safe to scale horizontally:
 * jobs are claimed with FOR UPDATE SKIP LOCKED and one account is processed by one worker at a time.
 */
import "./boot";
import { hostname } from "node:os";
import { env } from "../src/lib/env";
import { sql } from "../src/lib/db";
import { claim, complete, defer, enqueue, fail, prune, reapStale, type Job } from "../src/lib/queue";
import { runJob, RateDeferred } from "../src/lib/engine/processor";
import { MetaError } from "../src/lib/meta/graph";

const ID = `${hostname()}:${process.pid}`;
let running = 0;
let stopping = false;

async function execute(job: Job) {
  running++;
  const t0 = Date.now();
  try {
    await runJob(job);
    await complete(job.id);
    log("done", job, Date.now() - t0);
  } catch (e) {
    if (e instanceof RateDeferred) { await defer(job, e.ms); log("deferred", job, e.ms); }
    else if (e instanceof MetaError && !e.retryable) {
      // permanent (deleted comment, user blocked page, permission missing…) → don't hammer Meta
      await sql`update jobs set status = 'dead', last_error = ${e.message}, finished_at = now(), locked_at = null where id = ${job.id}`;
      if (job.kind === "reply") {
        await sql`update messages set status = 'failed', ai = ai || ${sql.json({ error: e.message })}
                  where conversation_id = ${job.payload.conversationId} and direction = 'in' and status = 'received'`;
      }
      log("dead", job, 0, e.message);
    } else {
      await fail(job, e);
      log("retry", job, 0, e instanceof Error ? e.message : String(e));
    }
  } finally { running--; }
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
