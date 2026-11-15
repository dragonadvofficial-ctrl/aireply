-- rply — initial schema
-- Works on Supabase (Postgres 15+) and on any self-hosted Postgres 15+ with pgvector.

create extension if not exists vector;

-- ───────────────────────── tenancy ─────────────────────────
create table if not exists workspaces (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  monthly_budget_usd numeric(10,2) not null default 50,
  brain_version      int not null default 1,          -- bumped on any knowledge/voice change → invalidates semantic cache
  created_at         timestamptz not null default now()
);

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  email         text not null unique,
  name          text,
  password_hash text not null,
  role          text not null default 'owner' check (role in ('owner','admin','agent')),
  created_at    timestamptz not null default now()
);

-- ───────────────────────── voice (personas) ─────────────────────────
create table if not exists personas (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  dialect      text not null default 'mirror',   -- mirror | eg | msa | gulf | en | franco
  formality    smallint not null default 35 check (formality between 0 and 100),
  emoji_level  smallint not null default 1 check (emoji_level between 0 and 3),
  max_chars    int not null default 280,
  tone         text not null default '',          -- free text: "friendly big sister, quick, never pushy"
  rules        text not null default '',          -- do / don't, one per line
  cta          text not null default '',          -- default call to action
  examples     jsonb not null default '[]',       -- [{ "in": "...", "out": "..." }]
  version      int not null default 1,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ───────────────────────── squads (account groups) ─────────────────────────
create table if not exists squads (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  color        text not null default 'lime',
  description  text not null default '',
  persona_id   uuid references personas(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ───────────────────────── connected accounts ─────────────────────────
create table if not exists accounts (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  squad_id         uuid references squads(id) on delete set null,
  persona_id       uuid references personas(id) on delete set null,   -- overrides squad persona
  platform         text not null check (platform in ('facebook','instagram')),
  connection       text not null check (connection in ('facebook_login','instagram_login')),
  external_id      text not null,            -- page id (fb) or IG professional account id
  page_id          text,                     -- linked page (IG via Facebook Login)
  name             text not null default '',
  username         text,
  avatar_url       text,
  access_token_enc text,
  token_expires_at timestamptz,
  status           text not null default 'active' check (status in ('active','paused','error','disconnected')),
  reply_mode       text not null default 'auto' check (reply_mode in ('auto','draft','off')),
  settings         jsonb not null default '{}',
  last_error       text,
  created_at       timestamptz not null default now(),
  unique (platform, external_id)
);
create index if not exists accounts_ws on accounts(workspace_id);
create index if not exists accounts_squad on accounts(squad_id);

-- ───────────────────────── brain (knowledge) ─────────────────────────
create table if not exists knowledge_sources (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  scope        text not null check (scope in ('workspace','squad','account')),
  scope_id     uuid,
  kind         text not null check (kind in ('note','faq','url','file','product')),
  title        text not null,
  content      text not null,
  pinned       boolean not null default false,   -- always in the cached prompt prefix
  status       text not null default 'ready' check (status in ('pending','ready','error')),
  tokens       int not null default 0,
  meta         jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists ks_scope on knowledge_sources(workspace_id, scope, scope_id);

create table if not exists knowledge_chunks (
  id           bigserial primary key,
  source_id    uuid not null references knowledge_sources(id) on delete cascade,
  workspace_id uuid not null,
  scope        text not null,
  scope_id     uuid,
  content      text not null,
  tokens       int not null default 0,
  embedding    vector(512)
);
create index if not exists kc_scope on knowledge_chunks(workspace_id, scope, scope_id);
create index if not exists kc_vec on knowledge_chunks using hnsw (embedding vector_cosine_ops);

-- zero-token rules
create table if not exists quick_replies (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  scope        text not null default 'workspace' check (scope in ('workspace','squad','account')),
  scope_id     uuid,
  name         text not null,
  triggers     text[] not null default '{}',
  match        text not null default 'contains' check (match in ('contains','exact','regex')),
  channel      text not null default 'any' check (channel in ('any','comment','dm')),
  replies      text[] not null default '{}',     -- rotated variants
  private_reply text,                           -- optional DM after a comment
  enabled      boolean not null default true,
  hits         int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists qr_ws on quick_replies(workspace_id) where enabled;

-- ───────────────────────── conversations ─────────────────────────
create table if not exists contacts (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references accounts(id) on delete cascade,
  external_id     text not null,
  name            text,
  username        text,
  last_inbound_at timestamptz,
  summary         text not null default '',
  tags            text[] not null default '{}',
  created_at      timestamptz not null default now(),
  unique (account_id, external_id)
);

create table if not exists conversations (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references accounts(id) on delete cascade,
  contact_id      uuid not null references contacts(id) on delete cascade,
  channel         text not null check (channel in ('dm','comment')),
  thread_ref      text not null,              -- post/media id for comments, 'dm' for DMs
  status          text not null default 'bot' check (status in ('bot','human','closed')),
  summary         text not null default '',
  summarized_n    int not null default 0,     -- messages covered by summary
  message_count   int not null default 0,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (account_id, channel, thread_ref, contact_id)
);
create index if not exists conv_recent on conversations(account_id, last_message_at desc);

create table if not exists messages (
  id                 uuid primary key default gen_random_uuid(),
  conversation_id    uuid not null references conversations(id) on delete cascade,
  account_id         uuid not null references accounts(id) on delete cascade,
  direction          text not null check (direction in ('in','out')),
  kind               text not null check (kind in ('comment','dm','reply','private_reply','note')),
  external_id        text,
  parent_external_id text,
  text               text not null default '',
  status             text not null default 'received'
                     check (status in ('received','answered','draft','sent','failed','ignored','hidden','handoff')),
  route              text,                    -- rule | cache | llm | human | skip
  ai                 jsonb not null default '{}',
  created_at         timestamptz not null default now()
);
create unique index if not exists msg_ext on messages(account_id, external_id) where external_id is not null;
create index if not exists msg_conv on messages(conversation_id, created_at);
create index if not exists msg_pending on messages(conversation_id) where direction = 'in' and status = 'received';

-- ───────────────────────── infra ─────────────────────────
create table if not exists webhook_events (
  id           bigserial primary key,
  object       text,
  payload      jsonb not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  error        text
);

-- Postgres-native job queue (FOR UPDATE SKIP LOCKED). No Redis needed.
create table if not exists jobs (
  id           bigserial primary key,
  kind         text not null,
  payload      jsonb not null default '{}',
  account_id   uuid,
  dedupe_key   text,
  status       text not null default 'queued' check (status in ('queued','running','done','failed','dead')),
  run_at       timestamptz not null default now(),
  attempts     int not null default 0,
  max_attempts int not null default 5,
  locked_at    timestamptz,
  locked_by    text,
  last_error   text,
  created_at   timestamptz not null default now(),
  finished_at  timestamptz
);
create unique index if not exists jobs_dedupe on jobs(dedupe_key) where status = 'queued';
create index if not exists jobs_ready on jobs(run_at) where status = 'queued';
create index if not exists jobs_running on jobs(account_id) where status = 'running';

-- semantic reply cache (exact-normalized match first, then vector)
create table if not exists reply_cache (
  id           bigserial primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  scope_key    text not null,
  question     text not null,
  question_norm text not null,
  embedding    vector(512),
  answer       text not null,
  hits         int not null default 0,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '14 days'
);
create index if not exists rc_exact on reply_cache(scope_key, question_norm);
create index if not exists rc_vec on reply_cache using hnsw (embedding vector_cosine_ops);

create table if not exists usage_events (
  id            bigserial primary key,
  workspace_id  uuid not null,
  account_id    uuid,
  kind          text not null,           -- chat | embed | summary
  model         text not null,
  route         text,
  input_tokens  int not null default 0,
  cached_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_usd      numeric(12,6) not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists usage_ws_time on usage_events(workspace_id, created_at);

create table if not exists rate_counters (
  account_id   uuid not null,
  bucket       text not null,
  window_start timestamptz not null,
  count        int not null default 0,
  primary key (account_id, bucket, window_start)
);

create table if not exists schema_migrations (
  name       text primary key,
  applied_at timestamptz not null default now()
);
