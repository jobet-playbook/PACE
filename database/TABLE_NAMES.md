# Database Table Names - With `pace_` Prefix

## ✅ All Tables Now Have `pace_` Prefix

All 10 tables in the normalized schema now use the `pace_` prefix for easy identification and to avoid conflicts with existing Supabase tables.

### Complete Table List

| # | Table Name | Purpose |
|---|------------|---------|
| 1 | `pace_qa_team_members` | QA team member information |
| 2 | `pace_qa_daily_reports` | Daily report metadata |
| 3 | `pace_qa_daily_member_stats` | Daily performance per member |
| 4 | `pace_qa_tickets` | Ticket master data |
| 5 | `pace_qa_ticket_completions` | Historical ticket completions |
| 6 | `pace_qa_wip_tickets` | Current WIP snapshots |
| 7 | `pace_qa_rollback_windows` | Time window aggregations |
| 8 | `pace_qa_30day_summary` | 30-day aggregated metrics |
| 9 | `pace_qa_member_30day_throughput` | Per-member 30-day stats |
| 10 | `pace_qa_insights` | AI-generated insights |

### Views (Also Prefixed)

| View Name | Purpose |
|-----------|---------|
| `vw_qa_member_performance_7d` | Last 7 days team member performance |
| `vw_qa_wip_summary` | Current WIP tickets summary |
| `vw_qa_throughput_trend` | 30-day throughput trends |

### Functions

| Function Name | Purpose |
|---------------|---------|
| `calculate_member_pace(member_id, days)` | Calculate member pace for any time window |
| `get_latest_report_summary()` | Get latest report overview |

## 🔍 Easy Searching in Supabase

With the `pace_` prefix, you can now:

1. **Search for all PACE tables**: Filter by `pace_` in the Supabase Table Editor
2. **Distinguish from other tables**: Your PACE tables won't mix with other project tables
3. **Organize better**: All related tables are grouped together alphabetically

### Example Searches in Supabase SQL Editor:

```sql
-- List all PACE tables
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename LIKE 'pace_%'
ORDER BY tablename;

-- Check table sizes
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size('public.' || tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename LIKE 'pace_%'
ORDER BY pg_total_relation_size('public.' || tablename) DESC;
```

## ✅ No Conflicts Guaranteed

### Why This Won't Break Anything:

1. **New table names**: All tables use the `pace_` prefix, so they won't conflict with:
   - Your existing `pace_qa_metrics` table (different name)
   - Any other tables in your Supabase project
   - Supabase system tables (use different schemas)

2. **Isolated schema**: These tables are completely separate from your current setup

3. **Safe to test**: You can run the schema script without affecting existing data

### Your Current Table:
- `pace_qa_metrics` (existing single-table structure)

### New Tables:
- `pace_qa_team_members`
- `pace_qa_daily_reports`
- `pace_qa_daily_member_stats`
- `pace_qa_tickets`
- `pace_qa_ticket_completions`
- `pace_qa_wip_tickets`
- `pace_qa_rollback_windows`
- `pace_qa_30day_summary`
- `pace_qa_member_30day_throughput`
- `pace_qa_insights`

**No overlap = No conflicts!** ✅

## 🚀 Next Steps

1. **Review the schema**: Check `database/schema.sql` to see all prefixed table names
2. **Run the schema**: Execute in Supabase SQL Editor to create tables
3. **Test safely**: New tables won't affect your existing `pace_qa_metrics` table
4. **Migrate when ready**: Use the migration script to move data from old to new structure

## 📝 Migration Notes

When you're ready to migrate:
- The migration script will need to be updated with the new table names
- Your existing `pace_qa_metrics` table will remain untouched during migration
- You can run both schemas in parallel for testing
- Only drop the old table after verifying the new schema works

## 🔐 Security

All tables have Row Level Security (RLS) enabled with policies for:
- **Read access**: Authenticated users
- **Write access**: Service role only (for automated data ingestion)

This ensures your data is secure and only accessible through proper authentication.
