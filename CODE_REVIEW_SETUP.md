# Code Review Metrics Setup Guide

## 🎯 Overview

The Code Review metrics system mirrors the QA metrics structure, tracking developer code review performance with real Jira data.

## 📊 Metrics Tracked

### **1. SP Throughput**
- Last 7 Days
- Last 28 Days
- Prior periods for comparison

### **2. Code Review PACE**
- Story Points per Business Day
- Calculated as: Total SP / Business Days

### **3. Assigned to Code Review Volume**
- Total Tickets currently in Code Review
- Total Story Points in Code Review

### **4. Cycle Time Metrics**

**CR-Cycle (To Code Review)**
- Average time from ticket creation to Code Review status
- Measured in business days

**T-Cycle (To Ready for Dev)**
- Average time from creation to Ready for Dev
- Measured in business days

**R-Age (CR Pushback)**
- Average time for tickets that got pushed back
- Measured in business days

### **5. Code Quality Issues**
- Critical CR Blockers (Open/Resolved)
- High-priority tickets that were pushed back

### **6. Daily Performance**
- Per-reviewer stats
- First Pass vs Repeat Pass breakdown
- Churn rate (repeat pass percentage)

## 🚀 API Endpoints

### **Live Code Review Metrics**

```bash
GET /api/code-review-metrics/live
```

**Response Structure:**
```json
{
  "output": {
    "report_meta": {
      "generated_at_et": "3/9/2026, 3:09:00 PM",
      "report_type": "Daily Code Review Performance Report",
      "today_label": "3/9/2026",
      "last_business_day_label": "3/6/2026"
    },
    "people": [
      {
        "reviewer_name": "Joey Stapleton",
        "today_stats": {
          "ticket_count": 2,
          "story_points": 5,
          "first_time_count": 1,
          "repeat_count": 1,
          "repeat_percentage": 50
        },
        "today_tickets": [...],
        "wip_count": 3,
        "wip_story_points": 12
      }
    ]
  },
  "rollback_windows": {
    "w7": {
      "rollback_window_description": "Last 7 Business Days",
      "cycle_time": {
        "to_code_review_avg_bd": 3.2,
        "to_ready_for_dev_avg_bd": 1.8,
        "to_pushback_avg_bd": 2.9
      },
      "throughput": {
        "total_story_points": 54.8,
        "total_tickets": 29,
        "pace_sp_per_bd": 7.8,
        "per_reviewer_throughput": [...]
      },
      "code_review_in_progress": {
        "total_tickets": 29,
        "total_story_points": 142,
        "per_reviewer_cr_in_progress": [...]
      },
      "quality_issues": {
        "critical_blockers_count": 0,
        "critical_blockers": {
          "total_count": 0,
          "unresolved_count": 0,
          "resolved_count": 1,
          "old_unresolved": []
        }
      }
    },
    "w28": {...},
    "prior_w7": {...},
    "prior_w28": {...}
  },
  "last_30_business_days": {
    "total_tickets": 156,
    "story_points": 542,
    "first_pass": {
      "ticket_count": 105,
      "story_points": 344
    },
    "repeat_pass": {
      "ticket_count": 51,
      "story_points": 198
    },
    "reviewers": [...]
  },
  "critical_blockers": [],
  "_cached": false,
  "_source": "jira_api"
}
```

## 🔄 Data Flow

```
User Request
    ↓
Check Cache Pool (5 min TTL)
    ↓ (miss)
Fetch from Jira (3 queries × 4 windows = 12 API calls)
    ↓
Process Code Review Metrics
    ↓
Cache Result
    ↓
Return to Frontend
```

## 📝 Jira Status Mapping

**Code Review Status:** `"Code Review"`

**Final Statuses (Completed CR):**
- `"Ready for Dev"`
- `"In Progress"`
- `"Done"`

**Pushback Statuses (Failed CR):**
- `"In Progress"`
- `"Open"`

## 🎨 Frontend Integration

### **Dashboard Sections to Update:**

**1. SP Throughput Card**
```typescript
// Use rollback_windows.w7.throughput.total_story_points
const last7DaysSP = data.rollback_windows.w7.throughput.total_story_points
const last28DaysSP = data.rollback_windows.w28.throughput.total_story_points
```

**2. Code Review PACE Card**
```typescript
// Use rollback_windows.w7.throughput.pace_sp_per_bd
const pace7Days = data.rollback_windows.w7.throughput.pace_sp_per_bd
const pace28Days = data.rollback_windows.w28.throughput.pace_sp_per_bd
```

**3. Assigned to Code Review Volume**
```typescript
// Use rollback_windows.w7.code_review_in_progress
const totalTickets = data.rollback_windows.w7.code_review_in_progress.total_tickets
const totalSP = data.rollback_windows.w7.code_review_in_progress.total_story_points
```

**4. Cycle Time Cards**
```typescript
// Use rollback_windows.w7.cycle_time
const crCycle7d = data.rollback_windows.w7.cycle_time.to_code_review_avg_bd
const tCycle7d = data.rollback_windows.w7.cycle_time.to_ready_for_dev_avg_bd
const rAge7d = data.rollback_windows.w7.cycle_time.to_pushback_avg_bd
```

**5. Code Quality Issues**
```typescript
// Use rollback_windows.w7.quality_issues
const criticalBlockers = data.rollback_windows.w7.quality_issues.critical_blockers
const openBlockers = criticalBlockers.unresolved_count
const resolvedBlockers = criticalBlockers.resolved_count
```

**6. Daily Performance**
```typescript
// Use output.people for per-reviewer stats
const reviewers = data.output.people.map(person => ({
  name: person.reviewer_name,
  today: {
    tickets: person.today_stats.ticket_count,
    sp: person.today_stats.story_points,
    firstPass: person.today_stats.first_time_count,
    repeatPass: person.today_stats.repeat_count,
    churn: person.today_stats.repeat_percentage
  },
  activities: person.today_tickets
}))
```

**7. Team Totals**
```typescript
// Sum from output.people
const teamTotals = {
  today: {
    tickets: data.output.people.reduce((sum, p) => sum + p.today_stats.ticket_count, 0),
    sp: data.output.people.reduce((sum, p) => sum + p.today_stats.story_points, 0),
    firstPass: data.output.people.reduce((sum, p) => sum + p.today_stats.first_time_count, 0),
    repeatPass: data.output.people.reduce((sum, p) => sum + p.today_stats.repeat_count, 0)
  },
  last30BD: data.last_30_business_days
}
```

## 🔧 Configuration

### **Jira Status Names**

Edit `lib/code-review-workflow.ts` if your Jira uses different status names:

```typescript
// Line 8: Code Review status
const CODE_REVIEW_STATUS = ['Code Review']  // Change to your status name

// Line 88-89: Final and pushback statuses
const finalStatusList = '"Ready for Dev", "In Progress", "Done"'
const pushbackStatusList = '"In Progress", "Open"'
```

### **Rollback Windows**

Default windows (same as QA metrics):
- w7: Last 7 Business Days
- w28: Last 28 Business Days
- prior_w7: Prior 7 Business Days (for comparison)
- prior_w28: Prior 28 Business Days (for comparison)

## 📊 Example Frontend Component

```typescript
'use client'

import { useEffect, useState } from 'react'

export default function CodeReviewDashboard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/code-review-metrics/live')
        const result = await response.json()
        setData(result)
      } catch (error) {
        console.error('Failed to fetch CR metrics:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) return <div>Loading...</div>
  if (!data) return <div>No data available</div>

  const w7 = data.rollback_windows.w7
  const w28 = data.rollback_windows.w28

  return (
    <div>
      {/* SP Throughput */}
      <div>
        <h3>SP Throughput</h3>
        <div>Last 7 Days: {w7.throughput.total_story_points} SP</div>
        <div>Last 28 Days: {w28.throughput.total_story_points} SP</div>
      </div>

      {/* Code Review PACE */}
      <div>
        <h3>Code Review PACE</h3>
        <div>Last 7 Days: {w7.throughput.pace_sp_per_bd} SP/BD</div>
        <div>Last 28 Days: {w28.throughput.pace_sp_per_bd} SP/BD</div>
      </div>

      {/* Cycle Times */}
      <div>
        <h3>CR-Cycle (To Code Review)</h3>
        <div>7d: {w7.cycle_time.to_code_review_avg_bd} bd</div>
        <div>28d: {w28.cycle_time.to_code_review_avg_bd} bd</div>
      </div>

      {/* Daily Performance */}
      <div>
        <h3>Team Totals</h3>
        <div>
          Today: {data.output.people.reduce((s, p) => s + p.today_stats.ticket_count, 0)} Tix / 
          {data.output.people.reduce((s, p) => s + p.today_stats.story_points, 0)} SP
        </div>
      </div>

      {/* Leaderboard */}
      <div>
        <h3>Leaderboard (Today by SP)</h3>
        {data.output.people
          .sort((a, b) => b.today_stats.story_points - a.today_stats.story_points)
          .map((person, idx) => (
            <div key={person.reviewer_name}>
              {idx + 1}. {person.reviewer_name} - 
              {person.today_stats.ticket_count} Tix, 
              {person.today_stats.story_points} SP, 
              Churn: {person.today_stats.repeat_percentage}%
            </div>
          ))}
      </div>
    </div>
  )
}
```

## 🧪 Testing

**1. Test the API endpoint:**
```bash
curl http://localhost:3000/api/code-review-metrics/live
```

**2. Check console logs:**
```
🔄 [CR Live] Fetching Code Review metrics...
📊 [CR Live] Cache miss, fetching from Jira...
📊 [CR] Processing rollback window: Last 7 Business Days
  ✓ [CR] Final Status: 29, Pushback: 0, Tracked Status (WIP): 29
📊 [CR] Processing rollback window: Last 28 Business Days
  ✓ [CR] Final Status: 156, Pushback: 1, Tracked Status (WIP): 29
💾 [CR Live] Data cached successfully
```

**3. Verify data structure:**
- Check `rollback_windows.w7.throughput.total_story_points` matches expected value
- Verify `output.people` contains reviewer data
- Confirm cycle times are reasonable numbers

## 🔄 Cache Behavior

**Same as QA metrics:**
- 5-minute cache TTL
- Stale cache fallback (up to 24 hours)
- Shared across all users
- Persists in Supabase

## 📈 Performance

**API Calls per Request:**
- 3 queries × 4 rollback windows = **12 Jira API calls**
- With cache: **0 calls** (served from cache)
- Effective reduction: **~95% fewer API calls**

## 🎯 Next Steps

1. ✅ Code Review workflow processor created
2. ✅ API endpoint created
3. ⏳ Update frontend to consume real data
4. ⏳ Replace dummy data with API calls
5. ⏳ Test with real Jira data
6. ⏳ Add to daily sync workflow

---

**The Code Review metrics system is ready to use! Just update your frontend components to fetch from `/api/code-review-metrics/live` instead of using dummy data.**
