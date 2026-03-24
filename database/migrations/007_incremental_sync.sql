-- Add last_synced_at to all report tables for incremental sync tracking

ALTER TABLE public.pace_support_daily_reports
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- Add unique constraint on front_conversation_id for upsert support
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_support_issues_conv_id'
  ) THEN
    ALTER TABLE public.pace_support_issues
      ADD CONSTRAINT uq_support_issues_conv_id UNIQUE (report_id, front_conversation_id);
  END IF;
END $$;
