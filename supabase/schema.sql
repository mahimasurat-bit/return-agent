-- Return Agent · Supabase schema
-- Paste into Supabase → SQL Editor → Run. Safe to run more than once.
--
-- The app's server talks to these tables with the service-role key only.
-- Row Level Security is ON with no policies, so the public anon key can read nothing.
--
-- Records are JSON documents shaped exactly like src/lib/types.ts
-- (Purchase, EmailSource, Return, Refund, AgentActivity), keyed per user.

create table if not exists inboxes (
  user_id            text primary key,          -- lowercased Google email
  email              text not null,
  refresh_token_enc  text not null,             -- AES-256-GCM, key derived from APP_SECRET
  last_synced_at     timestamptz,
  needs_reauth       boolean not null default false,
  skipped_ids        text[] not null default '{}',  -- non-shopping message ids already checked
  last_digest_at     timestamptz,
  created_at         timestamptz not null default now()
);

-- Upgrading an existing database? This adds the digest column safely:
alter table inboxes add column if not exists last_digest_at timestamptz;

create table if not exists records (
  user_id     text not null,
  collection  text not null check (collection in ('purchases','emails','returns','refunds','activities')),
  id          text not null,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, collection, id)
);

create index if not exists records_user_idx on records (user_id, collection);
create index if not exists records_order_idx on records ((data->>'orderNumber')) where collection in ('purchases','emails');

alter table inboxes enable row level security;
alter table records enable row level security;
-- No policies on purpose: only the server (service role) can read or write.
