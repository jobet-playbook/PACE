# PACE Testing Metrics - Database Documentation

## Overview

This directory contains the database schema, migration scripts, and documentation for the PACE Testing Metrics system. The database is designed to store QA/Testing team performance data in a scalable, normalized structure optimized for querying and analysis.

## Architecture

### Design Principles

1. **Normalization**: Data is split into logical entities to reduce redundancy
2. **Performance**: Strategic indexes on frequently queried columns
3. **Scalability**: Designed to handle growing data volumes efficiently
4. **Integrity**: Foreign key constraints ensure data consistency
5. **Security**: Row-level security policies for access control

### Entity Relationship Diagram

```
qa_team_members (Master data)
    ↓
qa_daily_reports (Daily report metadata)
    ↓
    ├── qa_daily_member_stats (Daily performance per member)
    │       ↓
    │   qa_ticket_completions (Individual ticket completions)
    │       ↓
    │   qa_tickets (Ticket master data)
    │
    ├── qa_wip_tickets (Work in progress snapshots)
    │       ↓
    │   qa_tickets
    │
    ├── qa_rollback_windows (Time window aggregations)
    │
    ├── qa_30day_summary (30-day metrics)
    │       ↓
    │   qa_member_30day_throughput (Per-member 30-day stats)
    │
    └── qa_insights (AI-generated insights)
```

## Files

### `schema.sql`
Complete database schema including:
- 10 normalized tables
- Indexes for performance optimization
- Views for common queries
- Functions for data aggregation
- Triggers for automatic updates
- Row-level security policies
- Sample seed data

### `migrate-data.ts`
TypeScript migration script that:
- Reads data from old `pace_qa_metrics` table
- Transforms and normalizes the data
- Inserts into new schema tables
- Handles data integrity and relationships
- Provides progress logging

### `MIGRATION_GUIDE.md`
Comprehensive guide covering:
- Current vs. new architecture comparison
- Step-by-step migration process
- Code examples for new queries
- Performance optimization tips
- Rollback procedures
- Monitoring and maintenance

## Quick Start

### 1. Create Schema

**Option A: Using Supabase Dashboard**
1. Go to SQL Editor in Supabase Dashboard
2. Copy contents of `schema.sql`
3. Execute the script

**Option B: Using psql**
```bash
psql -h your-supabase-host -U postgres -d postgres -f database/schema.sql
```

### 2. Migrate Existing Data

```bash
# Install dependencies
npm install

# Set environment variables
export NEXT_PUBLIC_SUPABASE_URL="your-url"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="your-key"

# Run migration
npx tsx database/migrate-data.ts
```

### 3. Verify Migration

```sql
-- Check record counts
SELECT 'qa_daily_reports' as table_name, COUNT(*) as count FROM qa_daily_reports
UNION ALL
SELECT 'qa_team_members', COUNT(*) FROM qa_team_members
UNION ALL
SELECT 'qa_daily_member_stats', COUNT(*) FROM qa_daily_member_stats
UNION ALL
SELECT 'qa_ticket_completions', COUNT(*) FROM qa_ticket_completions;
```

## Database Tables

### Core Tables

#### `qa_team_members`
Stores QA team member information.

**Key Columns:**
- `id` (UUID): Primary key
- `name` (VARCHAR): Member name (unique)
- `email` (VARCHAR): Email address
- `role` (VARCHAR): Role (default: 'QA Engineer')
- `is_active` (BOOLEAN): Active status

**Indexes:**
- `idx_qa_team_members_name`
- `idx_qa_team_members_active`

#### `qa_daily_reports`
Stores metadata for each daily QA report.

**Key Columns:**
- `id` (UUID): Primary key
- `report_date` (DATE): Report date (unique)
- `generated_at` (TIMESTAMPTZ): Generation timestamp
- `status` (VARCHAR): Report status (RED/YELLOW/GREEN)
- `docs_id` (VARCHAR): Google Docs ID

**Indexes:**
- `idx_qa_daily_reports_date`
- `idx_qa_daily_reports_status`

#### `qa_daily_member_stats`
Stores daily performance statistics for each team member.

**Key Columns:**
- `report_id` (UUID): FK to qa_daily_reports
- `member_id` (UUID): FK to qa_team_members
- `tickets_completed` (INT): Tickets completed
- `story_points_completed` (DECIMAL): Story points completed
- `first_time_pass_count` (INT): First-time passes
- `repeat_pass_count` (INT): Repeat passes
- `repeat_percentage` (DECIMAL): Repeat percentage

**Indexes:**
- `idx_qa_daily_member_stats_report`
- `idx_qa_daily_member_stats_member`
- `idx_qa_daily_member_stats_date`

#### `qa_tickets`
Stores individual ticket information.

**Key Columns:**
- `id` (UUID): Primary key
- `ticket_key` (VARCHAR): Ticket key (unique, e.g., PBSCR-9972)
- `summary` (TEXT): Ticket summary
- `story_points` (DECIMAL): Story points
- `priority` (VARCHAR): Priority level

**Indexes:**
- `idx_qa_tickets_key`

#### `qa_ticket_completions`
Stores each ticket completion event for historical tracking.

**Key Columns:**
- `ticket_id` (UUID): FK to qa_tickets
- `member_id` (UUID): FK to qa_team_members
- `report_id` (UUID): FK to qa_daily_reports
- `completed_at` (TIMESTAMPTZ): Completion timestamp
- `pass_type` (VARCHAR): 'first_time_pass' or 'repeat_pass'
- `qa_return_cycles_count` (INT): Number of QA cycles

**Indexes:**
- `idx_qa_ticket_completions_ticket`
- `idx_qa_ticket_completions_member`
- `idx_qa_ticket_completions_date`

#### `qa_wip_tickets`
Stores current work-in-progress tickets in QA.

**Key Columns:**
- `ticket_id` (UUID): FK to qa_tickets
- `assignee_id` (UUID): FK to qa_team_members
- `age_business_days` (INT): Age in business days
- `is_critical` (BOOLEAN): Critical flag
- `is_old` (BOOLEAN): Old flag (age > 7 days)
- `snapshot_date` (DATE): Snapshot date

**Indexes:**
- `idx_qa_wip_tickets_assignee`
- `idx_qa_wip_tickets_snapshot_date`
- `idx_qa_wip_tickets_critical` (partial)
- `idx_qa_wip_tickets_old` (partial)

### Aggregation Tables

#### `qa_rollback_windows`
Stores aggregated metrics for different time windows (7d, 28d, etc.).

**Window Types:**
- `w7`: Last 7 days
- `w28`: Last 28 days
- `prior_w7`: 7 days prior to w7
- `prior_w28`: 28 days prior to w28

**Metrics:**
- Cycle time (to QA, to Done, to Pushback)
- Throughput (story points, tickets)
- QA in progress (tickets, story points)
- Defects (escaped, critical)

#### `qa_30day_summary`
Stores aggregated 30-day metrics.

**Key Columns:**
- `total_tickets` (INT): Total tickets
- `first_qa_cycle_tickets` (INT): First-time QA tickets
- `returning_qa_cycle_tickets` (INT): Returning tickets
- Story points for each category

#### `qa_member_30day_throughput`
Stores per-member throughput for last 30 business days.

**Key Columns:**
- `summary_id` (UUID): FK to qa_30day_summary
- `member_id` (UUID): FK to qa_team_members
- `handled_ticket_count` (INT): Tickets handled
- `handled_ticket_story_points` (DECIMAL): Story points handled

#### `qa_insights`
Stores AI-generated insights and recommended actions.

**Key Columns:**
- `insight_type` (VARCHAR): 'thirty_second_take' or 'whats_driving_today'
- `summary` (TEXT): Insight summary
- `priority` (VARCHAR): Priority level
- `points` (JSONB): Array of insight points
- `actions` (JSONB): Array of recommended actions

## Views

### `vw_qa_member_performance_7d`
Shows team member performance for the last 7 days.

**Columns:**
- `member_name`
- `days_worked`
- `total_tickets`
- `total_story_points`
- `avg_daily_story_points`
- `first_time_passes`
- `repeat_passes`
- `avg_repeat_percentage`

**Usage:**
```sql
SELECT * FROM vw_qa_member_performance_7d
ORDER BY total_story_points DESC;
```

### `vw_qa_wip_summary`
Shows current WIP tickets summary by assignee.

**Columns:**
- `assignee_name`
- `wip_ticket_count`
- `total_story_points`
- `avg_age_days`
- `critical_count`
- `old_count`

**Usage:**
```sql
SELECT * FROM vw_qa_wip_summary
WHERE wip_ticket_count > 0;
```

### `vw_qa_throughput_trend`
Shows throughput trends for the last 30 days.

**Columns:**
- `report_date`
- `active_members`
- `total_story_points`
- `total_tickets`
- `avg_story_points_per_ticket`

**Usage:**
```sql
SELECT * FROM vw_qa_throughput_trend
ORDER BY report_date DESC
LIMIT 7;
```

## Functions

### `calculate_member_pace(member_id, days)`
Calculates member pace for any time window.

**Parameters:**
- `p_member_id` (UUID): Member ID
- `p_days` (INT): Number of days

**Returns:**
- `member_name` (VARCHAR)
- `pace` (DECIMAL)
- `story_points` (DECIMAL)
- `tickets` (INT)
- `avg_daily_pace` (DECIMAL)

**Usage:**
```sql
SELECT * FROM calculate_member_pace(
  '123e4567-e89b-12d3-a456-426614174000',
  7
);
```

### `get_latest_report_summary()`
Gets summary of the latest daily report.

**Returns:**
- `report_date` (DATE)
- `total_members` (INT)
- `total_tickets` (INT)
- `total_story_points` (DECIMAL)
- `avg_repeat_percentage` (DECIMAL)
- `critical_wip_count` (INT)
- `old_wip_count` (INT)

**Usage:**
```sql
SELECT * FROM get_latest_report_summary();
```

## Common Queries

### Get Team Member Performance (Last 7 Days)
```sql
SELECT * FROM vw_qa_member_performance_7d;
```

### Get Current WIP Tickets
```sql
SELECT 
  t.ticket_key,
  tm.name as assignee,
  t.story_points,
  w.age_business_days,
  w.is_critical,
  w.is_old
FROM qa_wip_tickets w
JOIN qa_tickets t ON w.ticket_id = t.id
JOIN qa_team_members tm ON w.assignee_id = tm.id
WHERE w.snapshot_date = (SELECT MAX(snapshot_date) FROM qa_wip_tickets)
ORDER BY w.age_business_days DESC;
```

### Get Member Daily Trend (Last 30 Days)
```sql
SELECT 
  dms.report_date,
  tm.name,
  dms.tickets_completed,
  dms.story_points_completed,
  dms.repeat_percentage
FROM qa_daily_member_stats dms
JOIN qa_team_members tm ON dms.member_id = tm.id
WHERE tm.name = 'charlson'
  AND dms.report_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY dms.report_date DESC;
```

### Get Ticket Completion History
```sql
SELECT 
  tc.completion_date,
  t.ticket_key,
  tm.name as completed_by,
  tc.story_points,
  tc.pass_type,
  tc.qa_return_cycles_count
FROM qa_ticket_completions tc
JOIN qa_tickets t ON tc.ticket_id = t.id
JOIN qa_team_members tm ON tc.member_id = tm.id
WHERE tc.completion_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY tc.completion_date DESC, tc.completed_at DESC;
```

### Get Rollback Window Metrics
```sql
SELECT 
  r.report_date,
  rw.window_type,
  rw.total_story_points,
  rw.total_tickets,
  rw.to_qa_avg_bd,
  rw.to_done_avg_bd,
  rw.escaped_defects_count
FROM qa_rollback_windows rw
JOIN qa_daily_reports r ON rw.report_id = r.id
WHERE r.report_date = (SELECT MAX(report_date) FROM qa_daily_reports)
ORDER BY 
  CASE rw.window_type
    WHEN 'w7' THEN 1
    WHEN 'w28' THEN 2
    WHEN 'prior_w7' THEN 3
    WHEN 'prior_w28' THEN 4
  END;
```

## Performance Optimization

### Index Usage
All frequently queried columns have indexes:
- Foreign keys
- Date columns
- Status flags
- Unique constraints

### Query Optimization Tips

1. **Use Views**: Pre-defined views are optimized for common queries
2. **Filter by Date**: Always include date filters for large tables
3. **Use Functions**: Built-in functions handle complex aggregations efficiently
4. **Limit Results**: Use `LIMIT` for pagination

### Monitoring Query Performance

```sql
-- Enable timing
\timing on

-- Explain query plan
EXPLAIN ANALYZE
SELECT * FROM vw_qa_member_performance_7d;

-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

## Maintenance

### Regular Tasks

**Daily:**
- Monitor database size
- Check for slow queries

**Weekly:**
- Review index usage
- Clean up old WIP snapshots (>90 days)

**Monthly:**
- Vacuum and analyze tables
- Review and optimize slow queries

### Cleanup Scripts

```sql
-- Remove old WIP snapshots
DELETE FROM qa_wip_tickets 
WHERE snapshot_date < CURRENT_DATE - INTERVAL '90 days';

-- Vacuum tables
VACUUM ANALYZE qa_ticket_completions;
VACUUM ANALYZE qa_daily_member_stats;
```

## Security

### Row Level Security (RLS)

All tables have RLS enabled with policies:
- **Read access**: Authenticated users
- **Write access**: Service role only

### Best Practices

1. Use service role key for data ingestion
2. Use anon key for read-only dashboard access
3. Never expose service role key in frontend
4. Regularly rotate API keys

## Troubleshooting

### Common Issues

**Issue: Migration fails with foreign key constraint error**
- **Solution**: Ensure team members are created before inserting stats

**Issue: Slow queries on large tables**
- **Solution**: Add date filters, use indexes, consider partitioning

**Issue: Duplicate key errors**
- **Solution**: Check unique constraints, handle conflicts with `ON CONFLICT`

### Debug Queries

```sql
-- Check for orphaned records
SELECT COUNT(*) FROM qa_daily_member_stats dms
WHERE NOT EXISTS (
  SELECT 1 FROM qa_team_members tm WHERE tm.id = dms.member_id
);

-- Check data consistency
SELECT 
  r.report_date,
  COUNT(DISTINCT dms.member_id) as members_in_stats,
  (SELECT COUNT(*) FROM qa_team_members WHERE is_active = true) as active_members
FROM qa_daily_reports r
LEFT JOIN qa_daily_member_stats dms ON r.id = dms.report_id
GROUP BY r.report_date
ORDER BY r.report_date DESC;
```

## Support

For questions or issues:
1. Check this documentation
2. Review `MIGRATION_GUIDE.md`
3. Check Supabase logs
4. Review query execution plans

## Future Enhancements

Potential improvements:
- [ ] Table partitioning for large historical data
- [ ] Materialized views for complex aggregations
- [ ] Real-time subscriptions for live updates
- [ ] Automated data archival
- [ ] Advanced analytics views
- [ ] Data export functionality
