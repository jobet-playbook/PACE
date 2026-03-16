-- ============================================================
-- Migration 003: Add per-member JSONB columns to rollback windows
-- Run this in your Supabase SQL editor.
-- ============================================================

-- The normalized pace_qa_rollback_windows table stores aggregated metrics
-- per time window (w7, w28, prior_w7, prior_w28). These two JSONB columns
-- store the per-member arrays that don't fit in the scalar columns:
--
--   per_member_throughput  → throughput.per_qa_member_throughput[]
--   per_member_wip         → qa_in_progress.per_qa_member_qa_in_progress[]

ALTER TABLE public.pace_qa_rollback_windows
  ADD COLUMN IF NOT EXISTS per_member_throughput JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS per_member_wip         JSONB NOT NULL DEFAULT '[]';

-- Also add write policy for service_role on all normalized tables
-- (service_role bypasses RLS but explicit policies are good practice
--  and required if you ever downgrade to anon key writes)

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pace_qa_team_members' AND policyname = 'allow_write_service_role'
  ) THEN
    CREATE POLICY allow_write_service_role ON public.pace_qa_team_members
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pace_qa_daily_reports' AND policyname = 'allow_write_service_role'
  ) THEN
    CREATE POLICY allow_write_service_role ON public.pace_qa_daily_reports
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pace_qa_daily_member_stats' AND policyname = 'allow_write_service_role'
  ) THEN
    CREATE POLICY allow_write_service_role ON public.pace_qa_daily_member_stats
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pace_qa_tickets' AND policyname = 'allow_write_service_role'
  ) THEN
    CREATE POLICY allow_write_service_role ON public.pace_qa_tickets
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pace_qa_ticket_completions' AND policyname = 'allow_write_service_role'
  ) THEN
    CREATE POLICY allow_write_service_role ON public.pace_qa_ticket_completions
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pace_qa_wip_tickets' AND policyname = 'allow_write_service_role'
  ) THEN
    CREATE POLICY allow_write_service_role ON public.pace_qa_wip_tickets
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pace_qa_rollback_windows' AND policyname = 'allow_write_service_role'
  ) THEN
    CREATE POLICY allow_write_service_role ON public.pace_qa_rollback_windows
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pace_qa_30day_summary' AND policyname = 'allow_write_service_role'
  ) THEN
    CREATE POLICY allow_write_service_role ON public.pace_qa_30day_summary
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pace_qa_member_30day_throughput' AND policyname = 'allow_write_service_role'
  ) THEN
    CREATE POLICY allow_write_service_role ON public.pace_qa_member_30day_throughput
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;
