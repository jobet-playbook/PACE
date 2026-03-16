-- ============================================================
-- Migration 002: Add snapshot + cache tables
-- Run this in your Supabase SQL editor.
-- All other pace_qa_* tables already exist.
-- ============================================================


-- ============================================================
-- 1. pace_qa_snapshots
-- Full daily QA metrics payload written by the sync cron.
-- The live endpoint reads the most recent row (< 23 h old)
-- instead of calling Jira on every dashboard load.
-- ============================================================

create table if not exists public.pace_qa_snapshots (
  id         uuid                     not null default gen_random_uuid(),
  synced_at  timestamp with time zone not null default now(),
  source     character varying(50)    not null default 'sync',
  data       jsonb                    not null,
  constraint pace_qa_snapshots_pkey primary key (id)
) tablespace pg_default;

create index if not exists idx_pace_qa_snapshots_synced_at
  on public.pace_qa_snapshots using btree (synced_at desc) tablespace pg_default;

comment on table public.pace_qa_snapshots is
  'Full daily QA metrics snapshots. Written by the sync job once per day. '
  'source = ''sync'' (cron), ''manual'' (on-demand), ''live_fallback'' (first load before first sync).';


-- ============================================================
-- 2. pace_cache_pool
-- Short-lived in-memory + Supabase cache used by cache-pool.ts.
-- TTL is enforced in application code (5 min fresh / 24 h stale).
-- ============================================================

create table if not exists public.pace_cache_pool (
  id         uuid                     not null default gen_random_uuid(),
  cache_key  character varying(255)   not null,
  data       jsonb                    not null,
  cached_at  timestamp with time zone not null default now(),
  created_at timestamp with time zone null     default now(),
  updated_at timestamp with time zone null     default now(),
  constraint pace_cache_pool_pkey        primary key (id),
  constraint pace_cache_pool_key_unique  unique (cache_key)
) tablespace pg_default;

create index if not exists idx_pace_cache_pool_key
  on public.pace_cache_pool using btree (cache_key) tablespace pg_default;

create index if not exists idx_pace_cache_pool_cached_at
  on public.pace_cache_pool using btree (cached_at desc) tablespace pg_default;

comment on table public.pace_cache_pool is
  'Persistent layer of the in-memory cache pool. Shared across Vercel instances. '
  'TTL is enforced in application code — rows here are never auto-deleted.';


-- ============================================================
-- RLS
-- Both tables use service-role writes and open reads
-- (dashboard is internal, no user auth on these endpoints).
-- ============================================================

alter table public.pace_qa_snapshots  enable row level security;
alter table public.pace_cache_pool     enable row level security;

-- Allow anyone to read snapshots (internal dashboard, no login required)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'pace_qa_snapshots' and policyname = 'allow_read_all'
  ) then
    create policy allow_read_all on public.pace_qa_snapshots
      for select using (true);
  end if;
end $$;

-- Allow service role to insert snapshots
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'pace_qa_snapshots' and policyname = 'allow_insert_service_role'
  ) then
    create policy allow_insert_service_role on public.pace_qa_snapshots
      for insert with check (auth.role() = 'service_role');
  end if;
end $$;

-- Cache pool: open read + service-role write
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'pace_cache_pool' and policyname = 'allow_read_all'
  ) then
    create policy allow_read_all on public.pace_cache_pool
      for select using (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'pace_cache_pool' and policyname = 'allow_write_service_role'
  ) then
    create policy allow_write_service_role on public.pace_cache_pool
      for all using (auth.role() = 'service_role');
  end if;
end $$;
