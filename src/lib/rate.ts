import { sql } from "./db";

/**
 * Fixed-window counter per account+bucket, stored in Postgres (works across many workers).
 * Returns 0 when allowed, otherwise ms to wait until the window resets.
 *
 * Meta limits we stay under (per account): private replies 750/h, Send API 300/s,
 * Conversations API 2/s. Public comment replies have no published cap → we keep a
 * conservative self-imposed one so the account never looks spammy.
 */
export const LIMITS = {
  private_reply: { limit: 700, windowSec: 3600 },
  comment_reply: { limit: 240, windowSec: 3600 },
  dm_send: { limit: 1200, windowSec: 60 },
} as const;

export async function take(accountId: string, bucket: keyof typeof LIMITS): Promise<number> {
  const { limit, windowSec } = LIMITS[bucket];
  const now = Date.now();
  const start = new Date(Math.floor(now / (windowSec * 1000)) * windowSec * 1000);
  const [row] = await sql<{ count: number }[]>`
    insert into rate_counters (account_id, bucket, window_start, count) values (${accountId}, ${bucket}, ${start}, 1)
    on conflict (account_id, bucket, window_start) do update set count = rate_counters.count + 1
    returning count`;
  if (row.count <= limit) return 0;
  return start.getTime() + windowSec * 1000 - now + 250;
}
