import { sql } from "./db";

export type JobKind = "reply" | "send" | "ingest_source" | "refresh_tokens" | "summarize";
export type Job = { id: number; kind: JobKind; payload: any; account_id: string | null; attempts: number; max_attempts: number };

/**
 * Enqueue a job. With a dedupe_key, a still-queued job with the same key is *pushed back*
 * (debounce): 3 DMs in 5 seconds → 1 AI call.
 */
export async function enqueue(kind: JobKind, payload: object, opts: { accountId?: string | null; dedupeKey?: string; delayMs?: number; maxAttempts?: number } = {}, tx = sql) {
  const runAt = new Date(Date.now() + (opts.delayMs ?? 0));
  if (opts.dedupeKey) {
    await tx`
      insert into jobs (kind, payload, account_id, dedupe_key, run_at, max_attempts)
      values (${kind}, ${tx.json(payload as any)}, ${opts.accountId ?? null}, ${opts.dedupeKey}, ${runAt}, ${opts.maxAttempts ?? 5})
      on conflict (dedupe_key) where status = 'queued'
      do update set run_at = excluded.run_at, payload = excluded.payload`;
  } else {
    await tx`
      insert into jobs (kind, payload, account_id, run_at, max_attempts)
      values (${kind}, ${tx.json(payload as any)}, ${opts.accountId ?? null}, ${runAt}, ${opts.maxAttempts ?? 5})`;
  }
}

/** Claim ready jobs; one running job per account at a time keeps per-account ordering + rate limits sane. */
export async function claim(workerId: string, limit: number): Promise<Job[]> {
  return sql<Job[]>`
    with picked as (
      select j.id from jobs j
      where j.status = 'queued' and j.run_at <= now()
        and (j.account_id is null or not exists (
          select 1 from jobs r where r.account_id = j.account_id and r.status = 'running'))
      order by j.run_at
      for update skip locked
      limit ${limit}
    )
    update jobs set status = 'running', locked_at = now(), locked_by = ${workerId}, attempts = attempts + 1
    from picked where jobs.id = picked.id
    returning jobs.id, jobs.kind, jobs.payload, jobs.account_id, jobs.attempts, jobs.max_attempts`;
}

export async function complete(id: number) {
  await sql`update jobs set status = 'done', finished_at = now(), locked_at = null where id = ${id}`;
}

/** Exponential backoff: 15s, 1m, 4m, 16m … then dead-letter. */
export async function fail(job: Job, err: unknown, retryInMs?: number) {
  const msg = err instanceof Error ? err.message : String(err);
  const dead = job.attempts >= job.max_attempts;
  const backoff = retryInMs ?? 15_000 * 4 ** (job.attempts - 1);
  await sql`
    update jobs set
      status = ${dead ? "dead" : "queued"},
      run_at = now() + (${backoff} || ' milliseconds')::interval,
      last_error = ${msg.slice(0, 2000)}, locked_at = null,
      finished_at = ${dead ? new Date() : null}
    where id = ${job.id}`;
}

/** Re-schedule without counting as a failure (e.g. rate limit window). */
export async function defer(job: Job, ms: number) {
  await sql`update jobs set status = 'queued', run_at = now() + (${ms} || ' milliseconds')::interval,
            attempts = greatest(attempts - 1, 0), locked_at = null where id = ${job.id}`;
}

/** Jobs stuck in running (crashed worker) go back to the queue. */
export async function reapStale(minutes = 5) {
  await sql`update jobs set status = 'queued', locked_at = null
            where status = 'running' and locked_at < now() - (${minutes} || ' minutes')::interval`;
}

export async function prune(days = 7) {
  await sql`delete from jobs where status = 'done' and finished_at < now() - (${days} || ' days')::interval`;
  await sql`delete from webhook_events where received_at < now() - (${days} || ' days')::interval`;
  await sql`delete from rate_counters where window_start < now() - interval '2 days'`;
  await sql`delete from reply_cache where expires_at < now()`;
}
