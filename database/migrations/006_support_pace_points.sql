-- Migration 006: Add total_pace_points columns to support tables
-- Supports heuristic complexity scoring (1-7 pace points per ticket)

ALTER TABLE pace_support_daily_reports
  ADD COLUMN IF NOT EXISTS total_pace_points INTEGER NOT NULL DEFAULT 0;

ALTER TABLE pace_support_agent_stats
  ADD COLUMN IF NOT EXISTS total_pace_points INTEGER NOT NULL DEFAULT 0;
