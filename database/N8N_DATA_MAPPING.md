# n8n Workflow → Database Schema Mapping

## Overview

This document maps the n8n workflow output to the normalized database schema, showing exactly how data flows from Jira → n8n → Supabase.

---

## 📊 n8n Workflow Data Structure

Based on your workflow, the final output contains:

### 1. **Daily Report Output** (from AI Agent)
```json
{
  "report_meta": {
    "generated_at_et": "timestamp",
    "report_type": "Daily QA Performance Report",
    "today_label": "MM/DD/YY",
    "last_business_day_label": "MM/DD/YY"
  },
  "today_overview": {
    "total_tickets": number,
    "total_story_points": number,
    "repeat_percentage": number,
    "first_time": {
      "ticket_count": number,
      "story_points": number
    },
    "repeat_pass": {
      "ticket_count": number,
      "story_points": number
    }
  },
  "last_business_day_overview": { /* same structure */ },
  "people": [
    {
      "qa_assignee": "string",
      "today_stats": {
        "ticket_count": number,
        "story_points": number,
        "first_time_count": number,
        "repeat_count": number,
        "repeat_percentage": number
      },
      "today_tickets": [
        {
          "ticket_id": "PBSCR-1234",
          "completed_time_et": "4:20 PM ET",
          "story_points": 5,
          "handled_stage": "Staging Test",
          "new_stage": "Push Production",
          "pass_type": "first_time_pass" | "repeat_pass",
          "qa_return_cycles_count": number,
          "had_previous_returns": boolean,
          "recap": "string"
        }
      ],
      "last_business_day_stats": { /* same as today_stats */ },
      "last_business_day_tickets": [ /* same as today_tickets */ ]
    }
  ]
}
```

### 2. **Rollback Windows** (from Code nodes)
```json
{
  "rollback_windows": {
    "w7": {
      "rollback_window_description": "Last 7 Days",
      "cycle_time": {
        "to_qa_avg_bd": number,
        "to_done_avg_bd": number,
        "to_pushback_avg_bd": number
      },
      "throughput": {
        "total_story_points": number,
        "total_qa_phase_story_points": number,
        "total_tickets": number,
        "per_qa_member_throughput": [
          {
            "qa_name": "string",
            "unique_ticket_count": number,
            "unique_ticket_story_points": number,
            "ticket_story_points": number,
            "ticket_count": number,
            "tickets": [
              {
                "ticket_key": "PBSCR-1234",
                "story_points": number,
                "history_id": "string",
                "handled_stage": "string"
              }
            ]
          }
        ]
      },
      "qa_in_progress": {
        "total_tickets": number,
        "total_story_points": number,
        "old_qa_wip_tickets": [
          {
            "ticket_key": "PBSCR-1234",
            "initial_qa_date": "ISO timestamp",
            "latest_qa_date": "ISO timestamp",
            "qa_repetition_count": number,
            "assignee": "string",
            "developer": "string",
            "story_points": number,
            "qa_status": "string",
            "priority": "string",
            "age_bd": number,
            "recent_age_bd": number,
            "summary": "string"
          }
        ],
        "critical_qa_wip_tickets": [ /* same structure */ ],
        "per_qa_member_qa_in_progress": [
          {
            "qa_assignee": "string",
            "qa_tickets_wip_count": number,
            "qa_tickets_wip_story_points_total": number,
            "tickets": [
              {
                "ticket_key": "PBSCR-1234",
                "story_points": number,
                "qa_status": "string",
                "age_bd": number,
                "recent_age_bd": number,
                "summary": "string"
              }
            ]
          }
        ]
      },
      "defects": {
        "escaped_defects_count": number,
        "critical_defects": {
          "total_count": number,
          "unresolved_count": number,
          "resolved_count": number,
          "old_unresolved": [
            {
              "key": "PBSCR-1234",
              "summary": "string",
              "status": "string",
              "priority": "string",
              "age_bd": number
            }
          ]
        }
      }
    },
    "w28": { /* same structure */ },
    "prior_w7": { /* same structure */ },
    "prior_w28": { /* same structure */ }
  },
  "critical_qa_wip_tickets": [ /* deduplicated array */ ],
  "old_qa_wip_tickets": [ /* deduplicated array */ ]
}
```

### 3. **Last 30 Business Days**
```json
{
  "last_30_business_days": {
    "total_tickets": number,
    "story_points": number,
    "first_qa_cycle": {
      "ticket_count": number,
      "story_points": number
    },
    "returning_qa_cycle": {
      "ticket_count": number,
      "story_points": number
    },
    "qa_handlers": [
      {
        "qa_assignee": "string",
        "handled_ticket_count": number,
        "handled_ticket_story_points": number
      }
    ]
  }
}
```

### 4. **AI Insights**
```json
{
  "status": "RED" | "YELLOW" | "GREEN",
  "thirty_second_take": {
    "summary": "string",
    "points": [
      {
        "name": "string",
        "description": "string",
        "priority": "high" | "medium" | "low"
      }
    ],
    "actions": [
      {
        "description": "string"
      }
    ]
  },
  "whats_driving_today": {
    "sections": [
      {
        "header": "string",
        "priority": "high" | "medium" | "low",
        "bullets": [
          {
            "text": "string",
            "action": "string"
          }
        ]
      }
    ]
  }
}
```

---

## 🗄️ Database Schema Mapping

### Table: `pace_qa_daily_reports`

**Source:** `report_meta`

| Database Column | n8n Field | Notes |
|----------------|-----------|-------|
| `report_date` | `report_meta.today_label` | Convert MM/DD/YY to YYYY-MM-DD |
| `generated_at` | `report_meta.generated_at_et` | Parse timestamp |
| `report_type` | `report_meta.report_type` | "Daily QA Performance Report" |
| `status` | AI output `status` | RED/YELLOW/GREEN |
| `docs_id` | Google Docs file ID | From workflow output |

---

### Table: `pace_qa_team_members`

**Source:** `people[].qa_assignee`

| Database Column | n8n Field | Notes |
|----------------|-----------|-------|
| `name` | `people[].qa_assignee` | Unique member name |
| `email` | N/A | Can be added later |
| `role` | Default: "QA Engineer" | |
| `is_active` | Default: true | |

---

### Table: `pace_qa_daily_member_stats`

**Source:** `people[].today_stats`

| Database Column | n8n Field | Notes |
|----------------|-----------|-------|
| `report_id` | FK to `pace_qa_daily_reports` | |
| `member_id` | FK to `pace_qa_team_members` | Match by `qa_assignee` |
| `report_date` | `report_meta.today_label` | |
| `tickets_completed` | `today_stats.ticket_count` | |
| `story_points_completed` | `today_stats.story_points` | |
| `first_time_pass_count` | `today_stats.first_time_count` | |
| `repeat_pass_count` | `today_stats.repeat_count` | |
| `repeat_percentage` | `today_stats.repeat_percentage` | |
| `total_actions` | N/A | Not in current workflow |
| `first_action_time` | N/A | Can extract from tickets |
| `last_action_time` | N/A | Can extract from tickets |

---

### Table: `pace_qa_tickets`

**Source:** `people[].today_tickets[].ticket_id`

| Database Column | n8n Field | Notes |
|----------------|-----------|-------|
| `ticket_key` | `today_tickets[].ticket_id` | e.g., "PBSCR-1234" |
| `summary` | From WIP tickets or Jira | |
| `story_points` | `today_tickets[].story_points` | |
| `priority` | From WIP tickets | |

---

### Table: `pace_qa_ticket_completions`

**Source:** `people[].today_tickets[]`

| Database Column | n8n Field | Notes |
|----------------|-----------|-------|
| `ticket_id` | FK to `pace_qa_tickets` | Match by `ticket_id` |
| `member_id` | FK to `pace_qa_team_members` | Match by `qa_assignee` |
| `report_id` | FK to `pace_qa_daily_reports` | |
| `completed_at` | `report_date + completed_time_et` | Combine date + time |
| `completion_date` | `report_meta.today_label` | |
| `completion_time` | `completed_time_et` | Parse time |
| `handled_stage` | `handled_stage` | |
| `new_stage` | `new_stage` | |
| `pass_type` | `pass_type` | "first_time_pass" or "repeat_pass" |
| `qa_return_cycles_count` | `qa_return_cycles_count` | |
| `had_previous_returns` | `had_previous_returns` | |
| `story_points` | `story_points` | |
| `recap` | `recap` | |

---

### Table: `pace_qa_wip_tickets`

**Source:** `rollback_windows.w7.qa_in_progress.old_qa_wip_tickets[]` and `critical_qa_wip_tickets[]`

| Database Column | n8n Field | Notes |
|----------------|-----------|-------|
| `ticket_id` | FK to `pace_qa_tickets` | Match by `ticket_key` |
| `assignee_id` | FK to `pace_qa_team_members` | Match by `assignee` |
| `developer_name` | `developer` | |
| `initial_qa_date` | `initial_qa_date` | ISO timestamp |
| `latest_qa_date` | `latest_qa_date` | ISO timestamp |
| `qa_repetition_count` | `qa_repetition_count` | |
| `qa_status` | `qa_status` | |
| `age_business_days` | `age_bd` | |
| `recent_age_business_days` | `recent_age_bd` | |
| `is_critical` | Check if in `critical_qa_wip_tickets` | Boolean |
| `is_old` | Check if `age_bd > 7` | Boolean |
| `snapshot_date` | `report_meta.today_label` | |
| `report_id` | FK to `pace_qa_daily_reports` | |

---

### Table: `pace_qa_rollback_windows`

**Source:** `rollback_windows[key]`

| Database Column | n8n Field | Notes |
|----------------|-----------|-------|
| `report_id` | FK to `pace_qa_daily_reports` | |
| `window_type` | Object key: "w7", "w28", "prior_w7", "prior_w28" | |
| `window_description` | `rollback_window_description` | |
| `to_qa_avg_bd` | `cycle_time.to_qa_avg_bd` | |
| `to_done_avg_bd` | `cycle_time.to_done_avg_bd` | |
| `to_pushback_avg_bd` | `cycle_time.to_pushback_avg_bd` | |
| `total_story_points` | `throughput.total_story_points` | |
| `total_qa_phase_story_points` | `throughput.total_qa_phase_story_points` | |
| `total_tickets` | `throughput.total_tickets` | |
| `qa_in_progress_tickets` | `qa_in_progress.total_tickets` | |
| `qa_in_progress_story_points` | `qa_in_progress.total_story_points` | |
| `old_wip_tickets_count` | `qa_in_progress.old_qa_wip_tickets.length` | |
| `critical_wip_tickets_count` | `qa_in_progress.critical_qa_wip_tickets.length` | |
| `escaped_defects_count` | `defects.escaped_defects_count` | |
| `critical_defects_total` | `defects.critical_defects.total_count` | |
| `critical_defects_unresolved` | `defects.critical_defects.unresolved_count` | |
| `critical_defects_resolved` | `defects.critical_defects.resolved_count` | |

---

### Table: `pace_qa_30day_summary`

**Source:** `last_30_business_days`

| Database Column | n8n Field | Notes |
|----------------|-----------|-------|
| `report_id` | FK to `pace_qa_daily_reports` | |
| `total_tickets` | `total_tickets` | |
| `first_qa_cycle_tickets` | `first_qa_cycle.ticket_count` | |
| `returning_qa_cycle_tickets` | `returning_qa_cycle.ticket_count` | |
| `total_story_points` | `story_points` | |
| `first_qa_cycle_story_points` | `first_qa_cycle.story_points` | |
| `returning_qa_cycle_story_points` | `returning_qa_cycle.story_points` | |

---

### Table: `pace_qa_member_30day_throughput`

**Source:** `last_30_business_days.qa_handlers[]`

| Database Column | n8n Field | Notes |
|----------------|-----------|-------|
| `summary_id` | FK to `pace_qa_30day_summary` | |
| `member_id` | FK to `pace_qa_team_members` | Match by `qa_assignee` |
| `handled_ticket_count` | `handled_ticket_count` | |
| `handled_ticket_story_points` | `handled_ticket_story_points` | |

---

### Table: `pace_qa_insights`

**Source:** AI Agent output

| Database Column | n8n Field | Notes |
|----------------|-----------|-------|
| `report_id` | FK to `pace_qa_daily_reports` | |
| `insight_type` | "thirty_second_take" or "whats_driving_today" | |
| `summary` | `thirty_second_take.summary` | |
| `priority` | Derived from points | "high", "medium", "low" |
| `points` | `thirty_second_take.points` or `whats_driving_today.sections` | JSONB |
| `actions` | `thirty_second_take.actions` | JSONB |

---

## 🔄 Data Transformation Examples

### Example 1: Convert Date Format
```javascript
// n8n: "02/21/26"
// Database: "2026-02-21"

function parseDate(dateStr) {
  const [month, day, year] = dateStr.split('/');
  const fullYear = `20${year}`;
  return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}
```

### Example 2: Parse Time
```javascript
// n8n: "4:20 PM ET"
// Database: "16:20:00"

function parseTime(timeStr) {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return null;
  
  let [_, hours, minutes, period] = match;
  hours = parseInt(hours);
  
  if (period.toUpperCase() === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period.toUpperCase() === 'AM' && hours === 12) {
    hours = 0;
  }
  
  return `${hours.toString().padStart(2, '0')}:${minutes}:00`;
}
```

### Example 3: Determine Critical Flag
```javascript
// Check if ticket is in critical_qa_wip_tickets array
function isCritical(ticketKey, criticalTickets) {
  return criticalTickets.some(t => t.ticket_key === ticketKey);
}
```

---

## 📥 Data Ingestion Flow

### Current Flow (Your existing setup):
```
Jira → n8n Workflow → pace_qa_metrics (single table)
```

### New Normalized Flow:
```
Jira → n8n Workflow → Webhook/API → Normalized Tables
```

### Recommended Approach:

**Option 1: Dual Write (Safest for migration)**
```
n8n → POST to /api/qa-metrics → {
  Write to pace_qa_metrics (existing)
  Write to normalized tables (new)
}
```

**Option 2: Direct to Normalized (After testing)**
```
n8n → POST to /api/qa-metrics-v2 → {
  Write only to normalized tables
}
```

---

## 🎯 Key Mappings Summary

| n8n Output | Database Table | Key Field |
|-----------|----------------|-----------|
| `people[].qa_assignee` | `pace_qa_team_members` | `name` |
| `people[].today_stats` | `pace_qa_daily_member_stats` | `member_id` + `report_date` |
| `people[].today_tickets[]` | `pace_qa_ticket_completions` | `ticket_id` + `member_id` |
| `rollback_windows[key]` | `pace_qa_rollback_windows` | `report_id` + `window_type` |
| `rollback_windows.*.qa_in_progress.old_qa_wip_tickets` | `pace_qa_wip_tickets` | `ticket_id` + `snapshot_date` |
| `last_30_business_days` | `pace_qa_30day_summary` | `report_id` |
| `last_30_business_days.qa_handlers` | `pace_qa_member_30day_throughput` | `summary_id` + `member_id` |
| AI insights | `pace_qa_insights` | `report_id` + `insight_type` |

---

## ⚠️ Important Notes

1. **Deduplication**: The workflow already deduplicates `critical_qa_wip_tickets` and `old_qa_wip_tickets` - use these deduplicated arrays

2. **Time Zones**: All times are in ET (Eastern Time) - ensure proper timezone handling

3. **Story Points**: Can be `null` in Jira - treat as `0` in database

4. **Member Names**: Use exact names from n8n - they're already normalized in the workflow

5. **Window Types**: Always use keys: `w7`, `w28`, `prior_w7`, `prior_w28`

6. **Pass Type**: Determined by `qa_return_cycles_count`:
   - `0` = "first_time_pass"
   - `≥1` = "repeat_pass"

---

## 🚀 Next Steps

1. **Update API endpoint** to accept this exact n8n structure
2. **Create transformation functions** for date/time parsing
3. **Test with sample n8n output** before going live
4. **Set up dual-write** to both old and new schemas during migration
5. **Monitor data quality** and validate mappings
