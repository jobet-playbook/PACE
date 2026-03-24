-- Add last_synced_at to all report tables for incremental sync tracking

ALTER TABLE public.pace_support_daily_reports
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- Add unique constraint on front_conversation_id for upsert support
ALTER TABLE public.pace_support_issues
  ADD CONSTRAINT IF NOT EXISTS uq_support_issues_conv_id
  UNIQUE (report_id, front_conversation_id);
