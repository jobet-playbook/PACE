-- PRD/Docs Metrics tables for Jira data persistence
-- Avoids Jira rate limits by caching computed DocData snapshots + normalized tables

-- ── 1. Daily report summary ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pace_doc_daily_reports (
  id                         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date                date        NOT NULL UNIQUE,
  generated_at               timestamptz NOT NULL DEFAULT now(),
  status                     text        DEFAULT 'GREEN',
  recommendations            text[]      DEFAULT '{}',
  weighted_sp_change_pct     numeric(10,2) DEFAULT 0,
  raw_sp_change_pct          numeric(10,2) DEFAULT 0
);

-- ── 2. Window metrics (w7, prior_w7, w28) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pace_doc_window_metrics (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id             uuid        NOT NULL REFERENCES public.pace_doc_daily_reports(id) ON DELETE CASCADE,
  window_type           text        NOT NULL, -- 'w7' | 'prior_w7' | 'w28'
  total_tickets         int         NOT NULL DEFAULT 0,
  raw_story_points      numeric(10,2) DEFAULT 0,
  weighted_story_points numeric(10,2) DEFAULT 0,
  missing_story_points  int         DEFAULT 0,
  first_pass_sp         numeric(10,2) DEFAULT 0,
  repeat_pass_sp        numeric(10,2) DEFAULT 0,
  quality_issues        int         DEFAULT 0,
  d_cycle_avg_days      numeric(10,2) DEFAULT 0,
  t_cycle_avg_days      numeric(10,2) DEFAULT 0,
  p1                    int         DEFAULT 0,
  p2                    int         DEFAULT 0,
  p3                    int         DEFAULT 0,
  p4plus                int         DEFAULT 0,
  UNIQUE (report_id, window_type)
);

-- ── 3. Per-owner metrics per window ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pace_doc_owner_metrics (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id         uuid        NOT NULL REFERENCES public.pace_doc_daily_reports(id) ON DELETE CASCADE,
  owner             text        NOT NULL,
  window_type       text        NOT NULL DEFAULT 'w7',
  ticket_count      int         NOT NULL DEFAULT 0,
  ticket_keys       text,
  raw_sp            numeric(10,2) DEFAULT 0,
  weighted_sp       numeric(10,2) DEFAULT 0,
  missing_sp        int         DEFAULT 0,
  first_pass_count  int         DEFAULT 0,
  repeat_pass_count int         DEFAULT 0,
  first_pass_sp     numeric(10,2) DEFAULT 0,
  repeat_pass_sp    numeric(10,2) DEFAULT 0
);

-- ── 4. Pushback exclusions (history) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pace_doc_exclusions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id        uuid        NOT NULL REFERENCES public.pace_doc_daily_reports(id) ON DELETE CASCADE,
  ticket_key       text        NOT NULL,
  pass_count       int         DEFAULT 1,
  last_assignee    text,
  last_status      text,
  pushback_history jsonb       NOT NULL DEFAULT '[]'::jsonb
);

-- ── 5. WIP tickets (Open/Elaboration) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pace_doc_wip_tickets (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id           uuid        NOT NULL REFERENCES public.pace_doc_daily_reports(id) ON DELETE CASCADE,
  ticket_key          text        NOT NULL,
  summary             text,
  creator             text,
  assignee            text,
  developer           text,
  story_points        numeric(10,2),
  priority            text,
  status              text,
  age_bd              int         DEFAULT 0,
  recent_age_bd       int         DEFAULT 0,
  first_tracked_date  text,
  latest_tracked_date text,
  tracked_pass_count  int         DEFAULT 1
);

-- ── 6. Full JSON snapshots for fast reads ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pace_doc_snapshots (
  id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source    text        DEFAULT 'sync',
  data      jsonb       NOT NULL,
  synced_at timestamptz DEFAULT now()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_doc_reports_date
  ON public.pace_doc_daily_reports(report_date DESC);

CREATE INDEX IF NOT EXISTS idx_doc_window_metrics_report
  ON public.pace_doc_window_metrics(report_id);

CREATE INDEX IF NOT EXISTS idx_doc_owner_metrics_report
  ON public.pace_doc_owner_metrics(report_id);

CREATE INDEX IF NOT EXISTS idx_doc_exclusions_report
  ON public.pace_doc_exclusions(report_id);

CREATE INDEX IF NOT EXISTS idx_doc_wip_tickets_report
  ON public.pace_doc_wip_tickets(report_id);

CREATE INDEX IF NOT EXISTS idx_doc_snapshots_synced
  ON public.pace_doc_snapshots(synced_at DESC);

-- ── RLS policies (service role write access) ────────────────────────────────
ALTER TABLE public.pace_doc_daily_reports    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pace_doc_window_metrics   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pace_doc_owner_metrics    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pace_doc_exclusions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pace_doc_wip_tickets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pace_doc_snapshots        ENABLE ROW LEVEL SECURITY;

CREATE POLICY allow_write_service_role ON public.pace_doc_daily_reports
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY allow_write_service_role ON public.pace_doc_window_metrics
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY allow_write_service_role ON public.pace_doc_owner_metrics
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY allow_write_service_role ON public.pace_doc_exclusions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY allow_write_service_role ON public.pace_doc_wip_tickets
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY allow_write_service_role ON public.pace_doc_snapshots
  FOR ALL USING (true) WITH CHECK (true);
