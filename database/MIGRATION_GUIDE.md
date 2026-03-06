# Database Migration Guide

## Overview

This guide explains how to migrate from the current single-table `pace_qa_metrics` structure to the new normalized database schema for better scalability, performance, and maintainability.

## Current vs. New Architecture

### Current Structure (Single Table)
```
pace_qa_metrics
├── id
├── created_at
├── output (JSONB) - Contains all nested data
├── last_30_business_days (JSONB)
├── rollback_windows (JSONB)
├── critical_wip_tickets (JSONB)
├── old_qa_wip_tickets (JSONB)
└── docs_id
```

**Problems:**
- ❌ Large JSONB columns make queries slow
- ❌ Difficult to query specific team member performance
- ❌ No historical tracking of individual metrics
- ❌ Cannot efficiently aggregate data across time periods
- ❌ Redundant data storage

### New Structure (Normalized)
```
10 Specialized Tables:
├── qa_team_members (Team member master data)
├── qa_daily_reports (Report metadata)
├── qa_daily_member_stats (Daily performance per member)
├── qa_tickets (Ticket master data)
├── qa_ticket_completions (Historical ticket completions)
├── qa_wip_tickets (Current WIP snapshots)
├── qa_rollback_windows (Time window aggregations)
├── qa_30day_summary (30-day aggregated metrics)
├── qa_member_30day_throughput (Per-member 30-day stats)
└── qa_insights (AI-generated insights)
```

**Benefits:**
- ✅ Fast queries with proper indexes
- ✅ Easy to query individual team member trends
- ✅ Historical tracking for all metrics
- ✅ Efficient aggregations and reporting
- ✅ Reduced data redundancy
- ✅ Better data integrity with foreign keys

## Migration Steps

### Step 1: Create New Schema

Run the schema creation script:

```bash
psql -h your-supabase-host -U postgres -d postgres -f database/schema.sql
```

Or in Supabase Dashboard:
1. Go to SQL Editor
2. Copy contents of `schema.sql`
3. Run the script

### Step 2: Migrate Existing Data

Use the migration script to transform and load existing data:

```bash
node database/migrate-data.js
```

### Step 3: Update Application Code

Update your application to use the new schema:

**Before:**
```typescript
// Fetch from single table
const { data } = await supabase
  .from('pace_qa_metrics')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(1)
  .single()
```

**After:**
```typescript
// Fetch from normalized tables with joins
const { data: report } = await supabase
  .from('qa_daily_reports')
  .select(`
    *,
    qa_daily_member_stats (
      *,
      qa_team_members (name, email)
    ),
    qa_rollback_windows (*),
    qa_wip_tickets (
      *,
      qa_tickets (ticket_key, summary, story_points)
    )
  `)
  .order('report_date', { ascending: false })
  .limit(1)
  .single()
```

### Step 4: Verify Data Integrity

Run verification queries:

```sql
-- Check team member count
SELECT COUNT(*) FROM qa_team_members;

-- Check daily stats
SELECT report_date, COUNT(*) as member_count, SUM(story_points_completed) as total_sp
FROM qa_daily_member_stats
GROUP BY report_date
ORDER BY report_date DESC;

-- Check ticket completions
SELECT completion_date, COUNT(*) as tickets
FROM qa_ticket_completions
GROUP BY completion_date
ORDER BY completion_date DESC;
```

### Step 5: Update Data Ingestion Pipeline

Modify your data ingestion (n8n workflow or direct writes) to write to the new schema:

**Example: Insert new daily report**
```typescript
// 1. Create daily report
const { data: report } = await supabase
  .from('qa_daily_reports')
  .insert({
    report_date: '2026-03-05',
    generated_at: new Date().toISOString(),
    status: 'GREEN',
    docs_id: 'your-doc-id'
  })
  .select()
  .single()

// 2. Insert team member stats
const memberStats = output.people.map(person => ({
  report_id: report.id,
  member_id: getMemberId(person.personName), // Lookup member ID
  report_date: '2026-03-05',
  tickets_completed: person.today_stats.ticket_count,
  story_points_completed: person.today_stats.story_points,
  first_time_pass_count: person.today_stats.first_time_count,
  repeat_pass_count: person.today_stats.repeat_count,
  repeat_percentage: person.today_stats.repeat_percentage
}))

await supabase
  .from('qa_daily_member_stats')
  .insert(memberStats)

// 3. Insert ticket completions
const completions = output.people.flatMap(person => 
  person.today_tickets.map(ticket => ({
    ticket_id: getOrCreateTicketId(ticket.ticket_id),
    member_id: getMemberId(person.personName),
    report_id: report.id,
    completed_at: new Date(ticket.completed_time_et).toISOString(),
    completion_date: '2026-03-05',
    completion_time: ticket.completed_time_et,
    handled_stage: ticket.handled_stage,
    new_stage: ticket.new_stage,
    pass_type: ticket.pass_type,
    qa_return_cycles_count: ticket.qa_return_cycles_count,
    story_points: ticket.story_points,
    recap: ticket.recap
  }))
)

await supabase
  .from('qa_ticket_completions')
  .insert(completions)
```

## Performance Optimization

### Recommended Indexes (Already in schema.sql)

```sql
-- Member performance queries
CREATE INDEX idx_qa_daily_member_stats_date ON qa_daily_member_stats(report_date DESC);
CREATE INDEX idx_qa_daily_member_stats_member ON qa_daily_member_stats(member_id);

-- Ticket queries
CREATE INDEX idx_qa_ticket_completions_date ON qa_ticket_completions(completion_date DESC);
CREATE INDEX idx_qa_ticket_completions_member ON qa_ticket_completions(member_id);

-- WIP queries
CREATE INDEX idx_qa_wip_tickets_snapshot_date ON qa_wip_tickets(snapshot_date DESC);
CREATE INDEX idx_qa_wip_tickets_critical ON qa_wip_tickets(is_critical) WHERE is_critical = true;
```

### Query Optimization Tips

1. **Use Views for Common Queries**
   - `vw_qa_member_performance_7d` - Last 7 days performance
   - `vw_qa_wip_summary` - Current WIP summary
   - `vw_qa_throughput_trend` - 30-day throughput trend

2. **Use Functions for Complex Calculations**
   - `calculate_member_pace(member_id, days)` - Calculate pace for any window
   - `get_latest_report_summary()` - Get latest report overview

3. **Partition Large Tables** (For future scaling)
   ```sql
   -- Partition ticket_completions by month
   CREATE TABLE qa_ticket_completions_2026_03 
   PARTITION OF qa_ticket_completions
   FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
   ```

## Rollback Plan

If you need to rollback to the old schema:

1. Keep the old `pace_qa_metrics` table during migration
2. Run both systems in parallel for 1-2 weeks
3. Compare data consistency
4. Only drop old table after verification

```sql
-- Backup old table
CREATE TABLE pace_qa_metrics_backup AS 
SELECT * FROM pace_qa_metrics;

-- Drop new schema if needed
DROP SCHEMA IF EXISTS public CASCADE;
```

## Data Retention Policy

Recommended retention:
- **Daily stats**: Keep all (small size)
- **Ticket completions**: Keep all (for historical analysis)
- **WIP snapshots**: Keep last 90 days
- **Rollback windows**: Keep all (aggregated data)

```sql
-- Clean up old WIP snapshots (run monthly)
DELETE FROM qa_wip_tickets 
WHERE snapshot_date < CURRENT_DATE - INTERVAL '90 days';
```

## Monitoring Queries

### Check Database Size
```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Check Query Performance
```sql
-- Enable query timing
\timing on

-- Test common queries
SELECT * FROM vw_qa_member_performance_7d;
SELECT * FROM vw_qa_wip_summary;
```

## Support

For issues during migration:
1. Check logs in Supabase Dashboard
2. Verify foreign key constraints
3. Check data types match
4. Ensure all required fields are populated

## Next Steps After Migration

1. ✅ Update frontend to use new API queries
2. ✅ Update data ingestion pipeline
3. ✅ Set up automated backups
4. ✅ Configure monitoring and alerts
5. ✅ Document new query patterns for team
6. ✅ Train team on new schema
