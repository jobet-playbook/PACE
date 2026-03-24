-- Support Metrics tables for Front API data persistence
-- Avoids Front API rate limits by caching resolved conversation data

-- ── 1. Daily report summary ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pace_support_daily_reports (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date  date        NOT NULL UNIQUE,
  window_days  int         NOT NULL DEFAULT 7,
  total_tickets_resolved int NOT NULL DEFAULT 0,
  total_pace_points int NOT NULL DEFAULT 0,
  avg_cycle_time    numeric(8,2),
  median_cycle_time numeric(8,2),
  p90_cycle_time    numeric(8,2),
  generated_at timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Per-agent stats per report ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pace_support_agent_stats (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id        uuid        NOT NULL REFERENCES public.pace_support_daily_reports(id) ON DELETE CASCADE,
  agent_name       text        NOT NULL,
  tickets_resolved int         NOT NULL DEFAULT 0,
  total_pace_points int        NOT NULL DEFAULT 0,
  avg_cycle_time    numeric(8,2),
  median_cycle_time numeric(8,2),
  p90_cycle_time    numeric(8,2),
  UNIQUE(report_id, agent_name)
);

-- ── 3. Individual resolved conversations ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pace_support_issues (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id             uuid        NOT NULL REFERENCES public.pace_support_daily_reports(id) ON DELETE CASCADE,
  front_conversation_id text        NOT NULL,
  client_name           text,
  summary               text,
  priority              text        NOT NULL DEFAULT 'Medium',
  weight                int         NOT NULL DEFAULT 1,
  status                text        NOT NULL DEFAULT 'Resolved',
  assignee              text,
  date_opened           timestamptz,
  date_resolved         timestamptz,
  hours_to_resolve      numeric(8,2),
  exceeds_24_hours      boolean     NOT NULL DEFAULT false
);

-- ── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_support_reports_date
  ON public.pace_support_daily_reports(report_date DESC);

CREATE INDEX IF NOT EXISTS idx_support_agent_stats_report
  ON public.pace_support_agent_stats(report_id);

CREATE INDEX IF NOT EXISTS idx_support_issues_report
  ON public.pace_support_issues(report_id);

CREATE INDEX IF NOT EXISTS idx_support_issues_assignee
  ON public.pace_support_issues(assignee);

-- ── RLS policies (service role write access) ────────────────────────────────
ALTER TABLE public.pace_support_daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pace_support_agent_stats   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pace_support_issues        ENABLE ROW LEVEL SECURITY;

CREATE POLICY allow_write_service_role ON public.pace_support_daily_reports
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY allow_write_service_role ON public.pace_support_agent_stats
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY allow_write_service_role ON public.pace_support_issues
  FOR ALL USING (true) WITH CHECK (true);
