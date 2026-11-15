import { sql } from "../db";
import { env } from "../env";
import { claim, complete, defer, enqueue, fail, prune, reapStale, type Job } from "../queue";
import { runJob, RateDeferred } from "./processor";
import { MetaError } from "../meta/graph";

/** Run one claimed job and settle it (done / deferred / dead / retry). Shared by the worker and serverless drain. */
export async function executeJob(job: Job, workerId: string, log: (what: string, job: Job, n: number, err?: string) => void) {
  const t0 = Date.now();
  try {
    await runJob(job);
    await complete(job.id);
    log("done", job, Date.now() - t0);
  } catch (e) {
    if (e instanceof RateDeferred) { await defer(job, e.ms); log("deferred", job, e.ms); }
    else if (e instanceof MetaError && !e.retryable) {
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
  }
}

/**
 * Serverless drain (Vercel): process due jobs until the queue is quiet or the time budget ends.
 * Debounced jobs (a few seconds in the future) are waited for, so one webhook call can finish its own reply.
 */
export async function drain(budgetMs = 50_000) {
  const id = `serverless:${process.pid}`;
  const end = Date.now() + budgetMs;
  const log = (what: string, job: Job, n: number, err?: string) =>
    console.log(JSON.stringify({ t: new Date().toISOString(), w: id, what, job: job.id, kind: job.kind, acct: job.account_id, n, err }));
  await reapStale();
  let ran = 0;
  while (Date.now() < end) {
    const jobs = await claim(id, env.WORKER_CONCURRENCY).catch(() => [] as Job[]);
    if (jobs.length) { await Promise.all(jobs.map((j) => executeJob(j, id, log))); ran += jobs.length; continue; }
    const [next] = await sql<{ ms: number | null }[]>`
      select (extract(epoch from (min(run_at) - now())) * 1000)::int as ms
      from jobs where status in ('queued','running') and run_at < now() + interval '40 seconds'`;
    if (next?.ms == null) break;
    await new Promise((r) => setTimeout(r, Math.min(Math.max(next.ms ?? 300, 300), 2000)));
  }
  return ran;
}

export async function housekeeping() {
  await prune().catch(() => {});
  await enqueue("refresh_tokens", {}, { dedupeKey: "refresh_tokens" }).catch(() => {});
}
