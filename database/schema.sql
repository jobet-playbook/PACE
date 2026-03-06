-- ============================================================
-- PACE Testing Metrics - Normalized Database Schema
-- ============================================================
-- This schema provides a scalable, optimized structure for storing
-- QA/Testing team performance metrics with proper normalization
-- ============================================================

-- ============================================================
-- 1. TEAM MEMBERS TABLE
-- ============================================================
-- Stores QA team member information
CREATE TABLE pace_qa_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255),
  role VARCHAR(100) DEFAULT 'QA Engineer',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pace_qa_team_members_name ON pace_qa_team_members(name);
CREATE INDEX idx_pace_qa_team_members_active ON pace_qa_team_members(is_active);

-- ============================================================
-- 2. DAILY REPORTS TABLE
-- ============================================================
-- Stores metadata for each daily QA report
CREATE TABLE pace_qa_daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL UNIQUE,
  generated_at TIMESTAMPTZ NOT NULL,
  report_type VARCHAR(100) DEFAULT 'Daily QA Performance Report',
  status VARCHAR(50) DEFAULT 'GREEN', -- RED, YELLOW, GREEN
  docs_id VARCHAR(255), -- Google Docs ID
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pace_qa_daily_reports_date ON pace_qa_daily_reports(report_date DESC);
CREATE INDEX idx_pace_qa_daily_reports_status ON pace_qa_daily_reports(status);

-- ============================================================
-- 3. DAILY TEAM MEMBER STATS TABLE
-- ============================================================
-- Stores daily performance stats for each team member
CREATE TABLE pace_qa_daily_member_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES pace_qa_daily_reports(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES pace_qa_team_members(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  
  -- Today's stats
  tickets_completed INT DEFAULT 0,
  story_points_completed DECIMAL(10,2) DEFAULT 0,
  first_time_pass_count INT DEFAULT 0,
  repeat_pass_count INT DEFAULT 0,
  repeat_percentage DECIMAL(5,2) DEFAULT 0,
  
  -- Activity summary
  total_actions INT DEFAULT 0,
  first_action_time TIME,
  last_action_time TIME,
  total_inactive_minutes DECIMAL(10,2) DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(report_id, member_id)
);

CREATE INDEX idx_pace_qa_daily_member_stats_report ON pace_qa_daily_member_stats(report_id);
CREATE INDEX idx_pace_qa_daily_member_stats_member ON pace_qa_daily_member_stats(member_id);
CREATE INDEX idx_pace_qa_daily_member_stats_date ON pace_qa_daily_member_stats(report_date DESC);

-- ============================================================
-- 4. TICKETS TABLE
-- ============================================================
-- Stores individual ticket information
CREATE TABLE pace_qa_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_key VARCHAR(50) NOT NULL UNIQUE,
  summary TEXT,
  story_points DECIMAL(10,2),
  priority VARCHAR(50),
  ticket_type VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pace_qa_tickets_key ON pace_qa_tickets(ticket_key);

-- ============================================================
-- 5. TICKET COMPLETIONS TABLE
-- ============================================================
-- Stores each ticket completion event (for historical tracking)
CREATE TABLE pace_qa_ticket_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES pace_qa_tickets(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES pace_qa_team_members(id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES pace_qa_daily_reports(id) ON DELETE CASCADE,
  
  completed_at TIMESTAMPTZ NOT NULL,
  completion_date DATE NOT NULL,
  completion_time TIME NOT NULL,
  
  handled_stage VARCHAR(100),
  new_stage VARCHAR(100),
  pass_type VARCHAR(50), -- 'first_time_pass' or 'repeat_pass'
  qa_return_cycles_count INT DEFAULT 0,
  had_previous_returns BOOLEAN DEFAULT false,
  
  story_points DECIMAL(10,2),
  recap TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pace_qa_ticket_completions_ticket ON pace_qa_ticket_completions(ticket_id);
CREATE INDEX idx_pace_qa_ticket_completions_member ON pace_qa_ticket_completions(member_id);
CREATE INDEX idx_pace_qa_ticket_completions_date ON pace_qa_ticket_completions(completion_date DESC);
CREATE INDEX idx_pace_qa_ticket_completions_report ON pace_qa_ticket_completions(report_id);

-- ============================================================
-- 6. WIP TICKETS TABLE
-- ============================================================
-- Stores current work-in-progress tickets in QA
CREATE TABLE pace_qa_wip_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES pace_qa_tickets(id) ON DELETE CASCADE,
  assignee_id UUID NOT NULL REFERENCES pace_qa_team_members(id) ON DELETE CASCADE,
  developer_name VARCHAR(255),
  
  initial_qa_date TIMESTAMPTZ NOT NULL,
  latest_qa_date TIMESTAMPTZ NOT NULL,
  qa_repetition_count INT DEFAULT 0,
  qa_status VARCHAR(100),
  
  age_business_days INT DEFAULT 0,
  recent_age_business_days INT DEFAULT 0,
  
  is_critical BOOLEAN DEFAULT false,
  is_old BOOLEAN DEFAULT false, -- Age > 7 days
  
  snapshot_date DATE NOT NULL, -- Date this snapshot was taken
  report_id UUID REFERENCES pace_qa_daily_reports(id) ON DELETE CASCADE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(ticket_id, snapshot_date)
);

CREATE INDEX idx_pace_qa_wip_tickets_assignee ON pace_qa_wip_tickets(assignee_id);
CREATE INDEX idx_pace_qa_wip_tickets_snapshot_date ON pace_qa_wip_tickets(snapshot_date DESC);
CREATE INDEX idx_pace_qa_wip_tickets_critical ON pace_qa_wip_tickets(is_critical) WHERE is_critical = true;
CREATE INDEX idx_pace_qa_wip_tickets_old ON pace_qa_wip_tickets(is_old) WHERE is_old = true;

-- ============================================================
-- 7. ROLLBACK WINDOWS TABLE
-- ============================================================
-- Stores aggregated metrics for different time windows (7d, 28d, etc.)
CREATE TABLE pace_qa_rollback_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES pace_qa_daily_reports(id) ON DELETE CASCADE,
  window_type VARCHAR(50) NOT NULL, -- 'w7', 'w28', 'prior_w7', 'prior_w28'
  window_description TEXT,
  
  -- Cycle time metrics
  to_qa_avg_bd DECIMAL(10,2),
  to_done_avg_bd DECIMAL(10,2),
  to_pushback_avg_bd DECIMAL(10,2),
  
  -- Throughput metrics
  total_story_points DECIMAL(10,2),
  total_qa_phase_story_points DECIMAL(10,2),
  total_tickets INT,
  
  -- QA in progress metrics
  qa_in_progress_tickets INT,
  qa_in_progress_story_points DECIMAL(10,2),
  old_wip_tickets_count INT,
  critical_wip_tickets_count INT,
  
  -- Defect metrics
  escaped_defects_count INT DEFAULT 0,
  critical_defects_total INT DEFAULT 0,
  critical_defects_unresolved INT DEFAULT 0,
  critical_defects_resolved INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(report_id, window_type)
);

CREATE INDEX idx_pace_qa_rollback_windows_report ON pace_qa_rollback_windows(report_id);
CREATE INDEX idx_pace_qa_rollback_windows_type ON pace_qa_rollback_windows(window_type);

-- ============================================================
-- 8. LAST 30 BUSINESS DAYS SUMMARY TABLE
-- ============================================================
-- Stores aggregated 30-day metrics
CREATE TABLE pace_qa_30day_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES pace_qa_daily_reports(id) ON DELETE CASCADE,
  
  total_tickets INT DEFAULT 0,
  first_qa_cycle_tickets INT DEFAULT 0,
  returning_qa_cycle_tickets INT DEFAULT 0,
  
  total_story_points DECIMAL(10,2),
  first_qa_cycle_story_points DECIMAL(10,2),
  returning_qa_cycle_story_points DECIMAL(10,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(report_id)
);

CREATE INDEX idx_pace_qa_30day_summary_report ON pace_qa_30day_summary(report_id);

-- ============================================================
-- 9. MEMBER 30-DAY THROUGHPUT TABLE
-- ============================================================
-- Stores per-member throughput for last 30 business days
CREATE TABLE pace_qa_member_30day_throughput (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_id UUID NOT NULL REFERENCES pace_qa_30day_summary(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES pace_qa_team_members(id) ON DELETE CASCADE,
  
  handled_ticket_count INT DEFAULT 0,
  handled_ticket_story_points DECIMAL(10,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(summary_id, member_id)
);

CREATE INDEX idx_pace_qa_member_30day_throughput_summary ON pace_qa_member_30day_throughput(summary_id);
CREATE INDEX idx_pace_qa_member_30day_throughput_member ON pace_qa_member_30day_throughput(member_id);

-- ============================================================
-- 10. INSIGHTS AND ACTIONS TABLE
-- ============================================================
-- Stores AI-generated insights and recommended actions
CREATE TABLE pace_qa_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES pace_qa_daily_reports(id) ON DELETE CASCADE,
  
  insight_type VARCHAR(50), -- 'thirty_second_take', 'whats_driving_today'
  summary TEXT,
  priority VARCHAR(50), -- 'high', 'medium', 'low'
  
  points JSONB, -- Array of insight points
  actions JSONB, -- Array of recommended actions
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pace_qa_insights_report ON pace_qa_insights(report_id);
CREATE INDEX idx_pace_qa_insights_type ON pace_qa_insights(insight_type);

-- ============================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================

-- View: Latest team member performance (last 7 days)
CREATE OR REPLACE VIEW vw_qa_member_performance_7d AS
SELECT 
  m.id as member_id,
  m.name as member_name,
  COUNT(DISTINCT dms.report_date) as days_worked,
  SUM(dms.tickets_completed) as total_tickets,
  SUM(dms.story_points_completed) as total_story_points,
  AVG(dms.story_points_completed) as avg_daily_story_points,
  SUM(dms.first_time_pass_count) as first_time_passes,
  SUM(dms.repeat_pass_count) as repeat_passes,
  AVG(dms.repeat_percentage) as avg_repeat_percentage
FROM pace_qa_team_members m
LEFT JOIN pace_qa_daily_member_stats dms ON m.id = dms.member_id
WHERE dms.report_date >= CURRENT_DATE - INTERVAL '7 days'
  AND m.is_active = true
GROUP BY m.id, m.name
ORDER BY total_story_points DESC;

-- View: Current WIP tickets summary
CREATE OR REPLACE VIEW vw_qa_wip_summary AS
SELECT 
  m.name as assignee_name,
  COUNT(*) as wip_ticket_count,
  SUM(t.story_points) as total_story_points,
  AVG(w.age_business_days) as avg_age_days,
  SUM(CASE WHEN w.is_critical THEN 1 ELSE 0 END) as critical_count,
  SUM(CASE WHEN w.is_old THEN 1 ELSE 0 END) as old_count
FROM pace_qa_wip_tickets w
JOIN pace_qa_tickets t ON w.ticket_id = t.id
JOIN pace_qa_team_members m ON w.assignee_id = m.id
WHERE w.snapshot_date = (SELECT MAX(snapshot_date) FROM pace_qa_wip_tickets)
GROUP BY m.name
ORDER BY wip_ticket_count DESC;

-- View: Throughput trends (last 30 days)
CREATE OR REPLACE VIEW vw_qa_throughput_trend AS
SELECT 
  r.report_date,
  COUNT(DISTINCT tc.member_id) as active_members,
  SUM(tc.story_points) as total_story_points,
  COUNT(*) as total_tickets,
  AVG(tc.story_points) as avg_story_points_per_ticket
FROM pace_qa_daily_reports r
JOIN pace_qa_ticket_completions tc ON r.id = tc.report_id
WHERE r.report_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY r.report_date
ORDER BY r.report_date DESC;

-- ============================================================
-- FUNCTIONS FOR DATA AGGREGATION
-- ============================================================

-- Function: Calculate member pace for any time window
CREATE OR REPLACE FUNCTION calculate_member_pace(
  p_member_id UUID,
  p_days INT
)
RETURNS TABLE (
  member_name VARCHAR,
  pace DECIMAL,
  story_points DECIMAL,
  tickets INT,
  avg_daily_pace DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.name,
    SUM(dms.story_points_completed) as pace,
    SUM(dms.story_points_completed) as story_points,
    SUM(dms.tickets_completed)::INT as tickets,
    AVG(dms.story_points_completed) as avg_daily_pace
  FROM pace_qa_team_members m
  JOIN pace_qa_daily_member_stats dms ON m.id = dms.member_id
  WHERE m.id = p_member_id
    AND dms.report_date >= CURRENT_DATE - (p_days || ' days')::INTERVAL
  GROUP BY m.name;
END;
$$ LANGUAGE plpgsql;

-- Function: Get latest report summary
CREATE OR REPLACE FUNCTION get_latest_report_summary()
RETURNS TABLE (
  report_date DATE,
  total_members INT,
  total_tickets INT,
  total_story_points DECIMAL,
  avg_repeat_percentage DECIMAL,
  critical_wip_count INT,
  old_wip_count INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.report_date,
    COUNT(DISTINCT dms.member_id)::INT as total_members,
    SUM(dms.tickets_completed)::INT as total_tickets,
    SUM(dms.story_points_completed) as total_story_points,
    AVG(dms.repeat_percentage) as avg_repeat_percentage,
    (SELECT COUNT(*) FROM pace_qa_wip_tickets WHERE is_critical = true AND snapshot_date = r.report_date)::INT as critical_wip_count,
    (SELECT COUNT(*) FROM pace_qa_wip_tickets WHERE is_old = true AND snapshot_date = r.report_date)::INT as old_wip_count
  FROM pace_qa_daily_reports r
  JOIN pace_qa_daily_member_stats dms ON r.id = dms.report_id
  WHERE r.report_date = (SELECT MAX(report_date) FROM pace_qa_daily_reports)
  GROUP BY r.report_date;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================

-- Trigger: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pace_qa_team_members_updated_at
  BEFORE UPDATE ON pace_qa_team_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pace_qa_tickets_updated_at
  BEFORE UPDATE ON pace_qa_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pace_qa_wip_tickets_updated_at
  BEFORE UPDATE ON pace_qa_wip_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================
-- Enable RLS on all tables for security

ALTER TABLE pace_qa_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE pace_qa_daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE pace_qa_daily_member_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE pace_qa_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE pace_qa_ticket_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pace_qa_wip_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE pace_qa_rollback_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE pace_qa_30day_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE pace_qa_member_30day_throughput ENABLE ROW LEVEL SECURITY;
ALTER TABLE pace_qa_insights ENABLE ROW LEVEL SECURITY;

-- Policy: Allow read access to authenticated users
CREATE POLICY "Allow read access to authenticated users" ON pace_qa_team_members
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read access to authenticated users" ON pace_qa_daily_reports
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read access to authenticated users" ON pace_qa_daily_member_stats
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read access to authenticated users" ON pace_qa_tickets
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read access to authenticated users" ON pace_qa_ticket_completions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read access to authenticated users" ON pace_qa_wip_tickets
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read access to authenticated users" ON pace_qa_rollback_windows
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read access to authenticated users" ON pace_qa_30day_summary
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read access to authenticated users" ON pace_qa_member_30day_throughput
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read access to authenticated users" ON pace_qa_insights
  FOR SELECT USING (auth.role() = 'authenticated');

-- Policy: Allow insert/update for service role (for automated data ingestion)
CREATE POLICY "Allow insert for service role" ON pace_qa_daily_reports
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Allow insert for service role" ON pace_qa_daily_member_stats
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Add similar policies for other tables as needed

-- ============================================================
-- SAMPLE SEED DATA
-- ============================================================

-- Insert sample team members
INSERT INTO pace_qa_team_members (name, email, role) VALUES
  ('charlson', 'charlson@example.com', 'QA Engineer'),
  ('Ramcel', 'ramcel@example.com', 'QA Engineer'),
  ('Jake Galiano', 'jake@example.com', 'QA Engineer'),
  ('Clive Nys', 'clive@example.com', 'QA Engineer')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================

COMMENT ON TABLE pace_qa_team_members IS 'Stores QA team member information';
COMMENT ON TABLE pace_qa_daily_reports IS 'Stores metadata for each daily QA report';
COMMENT ON TABLE pace_qa_daily_member_stats IS 'Stores daily performance statistics for each team member';
COMMENT ON TABLE pace_qa_tickets IS 'Stores individual ticket information';
COMMENT ON TABLE pace_qa_ticket_completions IS 'Stores each ticket completion event for historical tracking';
COMMENT ON TABLE pace_qa_wip_tickets IS 'Stores current work-in-progress tickets in QA';
COMMENT ON TABLE pace_qa_rollback_windows IS 'Stores aggregated metrics for different time windows';
COMMENT ON TABLE pace_qa_30day_summary IS 'Stores aggregated 30-day metrics';
COMMENT ON TABLE pace_qa_member_30day_throughput IS 'Stores per-member throughput for last 30 business days';
COMMENT ON TABLE pace_qa_insights IS 'Stores AI-generated insights and recommended actions';
