-- ============================================================
-- Migration 004: Code Review metrics tables
-- Run this in your Supabase SQL editor.
-- ============================================================


-- ============================================================
-- 1. pace_cr_daily_reports
-- Anchor table — one row per calendar day.
-- ============================================================

create table if not exists public.pace_cr_daily_reports (
  id             uuid                     not null default gen_random_uuid(),
  report_date    date                     not null,
  generated_at   timestamp with time zone not null default now(),
  status         character varying(10)    not null default 'GREEN', -- GREEN | YELLOW | RED
  recommendations jsonb                   not null default '[]',
  weighted_sp_change_pct numeric(10,2)    not null default 0,
  raw_sp_change_pct      numeric(10,2)    not null default 0,
  constraint pace_cr_daily_reports_pkey       primary key (id),
  constraint pace_cr_daily_reports_date_unique unique (report_date)
) tablespace pg_default;

create index if not exists idx_pace_cr_daily_reports_date
  on public.pace_cr_daily_reports using btree (report_date desc) tablespace pg_default;

comment on table public.pace_cr_daily_reports is
  'One row per calendar day. Anchor for all Code Review metric FK relationships.';


-- ============================================================
-- 2. pace_cr_window_metrics
-- w7 and prior_w7 aggregate metrics per report.
-- ============================================================

create table if not exists public.pace_cr_window_metrics (
  id                    uuid         not null default gen_random_uuid(),
  report_id             uuid         not null references public.pace_cr_daily_reports(id) on delete cascade,
  window_type           varchar(20)  not null, -- 'w7' | 'prior_w7' | 'w28'
  total_tickets         int          not null default 0,
  raw_story_points      numeric(10,2) not null default 0,
  weighted_story_points numeric(10,2) not null default 0,
  missing_story_points  int          not null default 0,
  first_pass_sp         numeric(10,2) not null default 0,
  repeat_pass_sp        numeric(10,2) not null default 0,
  p1                    int          not null default 0, -- 1st-pass tickets
  p2                    int          not null default 0,
  p3                    int          not null default 0,
  p4plus                int          not null default 0,
  constraint pace_cr_window_metrics_pkey        primary key (id),
  constraint pace_cr_window_metrics_report_type unique (report_id, window_type)
) tablespace pg_default;

create index if not exists idx_pace_cr_window_metrics_report
  on public.pace_cr_window_metrics using btree (report_id) tablespace pg_default;

comment on table public.pace_cr_window_metrics is
  'w7 and prior_w7 aggregate metrics per daily CR report.';


-- ============================================================
-- 3. pace_cr_owner_metrics
-- Per-developer (creator) weekly metrics per report.
-- ============================================================

create table if not exists public.pace_cr_owner_metrics (
  id           uuid          not null default gen_random_uuid(),
  report_id    uuid          not null references public.pace_cr_daily_reports(id) on delete cascade,
  owner             varchar(255)  not null,
  window_type       varchar(20)   not null default 'w7', -- 'w7' | 'w28'
  ticket_count      int           not null default 0,
  ticket_keys       text          not null default '',
  raw_sp            numeric(10,2) not null default 0,
  weighted_sp       numeric(10,2) not null default 0,
  missing_sp        int           not null default 0,
  first_pass_count  int           not null default 0,
  repeat_pass_count int           not null default 0,
  constraint pace_cr_owner_metrics_pkey               primary key (id),
  constraint pace_cr_owner_metrics_report_owner_window unique (report_id, owner, window_type)
) tablespace pg_default;

create index if not exists idx_pace_cr_owner_metrics_report
  on public.pace_cr_owner_metrics using btree (report_id) tablespace pg_default;
create index if not exists idx_pace_cr_owner_metrics_owner
  on public.pace_cr_owner_metrics using btree (owner) tablespace pg_default;

comment on table public.pace_cr_owner_metrics is
  'Per-developer w7 Code Review metrics. owner = ticket creator (developer name).';


-- ============================================================
-- 4. pace_cr_exclusions
-- Tickets that re-entered Code Review in the last 28 days.
-- ============================================================

create table if not exists public.pace_cr_exclusions (
  id               uuid         not null default gen_random_uuid(),
  report_id        uuid         not null references public.pace_cr_daily_reports(id) on delete cascade,
  ticket_key       varchar(50)  not null,
  cr_pass_count    int          not null default 1,
  last_assignee    varchar(255),
  last_status      varchar(100),
  pushback_history jsonb        not null default '[]',
  constraint pace_cr_exclusions_pkey              primary key (id),
  constraint pace_cr_exclusions_report_ticket_key unique (report_id, ticket_key)
) tablespace pg_default;

create index if not exists idx_pace_cr_exclusions_report
  on public.pace_cr_exclusions using btree (report_id) tablespace pg_default;

comment on table public.pace_cr_exclusions is
  'Tickets that were pushed back from Code Review to In Progress in last 28 days.';


-- ============================================================
-- 5. pace_cr_snapshots
-- Full CRData payload — written every sync for easy retrieval
-- and as a fallback when Jira is unavailable.
-- ============================================================

create table if not exists public.pace_cr_snapshots (
  id        uuid                     not null default gen_random_uuid(),
  synced_at timestamp with time zone not null default now(),
  source    character varying(50)    not null default 'sync', -- 'sync' | 'live'
  data      jsonb                    not null,
  constraint pace_cr_snapshots_pkey primary key (id)
) tablespace pg_default;

create index if not exists idx_pace_cr_snapshots_synced_at
  on public.pace_cr_snapshots using btree (synced_at desc) tablespace pg_default;

comment on table public.pace_cr_snapshots is
  'Full CRData JSONB snapshots. Written on every sync. '
  'The live endpoint reads the most recent row (< 23h old) before calling Jira.';


-- ============================================================
-- RLS — open reads, service-role writes
-- ============================================================

alter table public.pace_cr_daily_reports  enable row level security;
alter table public.pace_cr_window_metrics enable row level security;
alter table public.pace_cr_owner_metrics  enable row level security;
alter table public.pace_cr_exclusions     enable row level security;
alter table public.pace_cr_snapshots      enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'pace_cr_daily_reports'  and policyname = 'allow_read_all') then
    create policy allow_read_all on public.pace_cr_daily_reports  for select using (true); end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'pace_cr_window_metrics' and policyname = 'allow_read_all') then
    create policy allow_read_all on public.pace_cr_window_metrics for select using (true); end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'pace_cr_owner_metrics'  and policyname = 'allow_read_all') then
    create policy allow_read_all on public.pace_cr_owner_metrics  for select using (true); end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'pace_cr_exclusions'     and policyname = 'allow_read_all') then
    create policy allow_read_all on public.pace_cr_exclusions     for select using (true); end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'pace_cr_snapshots'      and policyname = 'allow_read_all') then
    create policy allow_read_all on public.pace_cr_snapshots      for select using (true); end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'pace_cr_daily_reports'  and policyname = 'allow_write_service_role') then
    create policy allow_write_service_role on public.pace_cr_daily_reports  for all using (auth.role() = 'service_role'); end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'pace_cr_window_metrics' and policyname = 'allow_write_service_role') then
    create policy allow_write_service_role on public.pace_cr_window_metrics for all using (auth.role() = 'service_role'); end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'pace_cr_owner_metrics'  and policyname = 'allow_write_service_role') then
    create policy allow_write_service_role on public.pace_cr_owner_metrics  for all using (auth.role() = 'service_role'); end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'pace_cr_exclusions'     and policyname = 'allow_write_service_role') then
    create policy allow_write_service_role on public.pace_cr_exclusions     for all using (auth.role() = 'service_role'); end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'pace_cr_snapshots'      and policyname = 'allow_write_service_role') then
    create policy allow_write_service_role on public.pace_cr_snapshots      for all using (auth.role() = 'service_role'); end if;
end $$;
