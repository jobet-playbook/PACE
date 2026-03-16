# PACE Dashboard — Agent Handoff Document

> **Last updated:** March 16, 2026
> **Purpose:** Comprehensive summary for a new agent to continue development.

---

## 1. Project Overview

**PACE** is a Next.js 16 dashboard that tracks engineering team performance across five domains:

| Tab | Full Name | Data Source | Status |
|-----|-----------|-------------|--------|
| **T** - Testing / QA | QA Performance | **Live Jira API** | ✅ Working (with issues) |
| **R** - Code Review | Code Review Performance | **Hardcoded dummy data** | ⚠️ Backend built, frontend not wired |
| **P** - PRD / Docs | Documentation Performance | **Hardcoded dummy data** | ❌ Not started |
| **I** - Infrastructure | Infrastructure Metrics | **Hardcoded dummy data** | ❌ Not started |
| **S** - Support | Support Metrics | **Hardcoded dummy data** | ❌ Not started |

There is also a **TRIPS Summary** tab (aggregation view) and a **Data Model** tab.

### Tech Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **UI:** Tailwind CSS 4, shadcn/ui (Radix primitives), Recharts, Lucide icons
- **Database:** Supabase (PostgreSQL) + Prisma (legacy, mostly unused)
- **External API:** Jira Cloud REST API v3 (`/rest/api/3/search/jql`)
- **Caching:** Custom multi-layer cache pool (in-memory + Supabase)
- **Deployment target:** Vercel

### Environment Variables (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
JIRA_BASE_URL=https://callplaybook.atlassian.net
JIRA_EMAIL=...
JIRA_API_TOKEN=...
CRON_SECRET=...              # For sync/cache-warm auth
DATABASE_URL=file:./dev.db   # Prisma (legacy)
```

---

## 2. Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│  FRONTEND  (app/page.tsx — single-page dashboard)        │
│  ├─ QA Tab ─────── fetches /api/qa-metrics/live ──┐      │
│  ├─ CR Tab ─────── uses hardcoded dashboard-data  │      │
│  ├─ Docs Tab ───── uses hardcoded dashboard-data  │      │
│  ├─ Infra Tab ──── uses hardcoded dashboard-data  │      │
│  └─ Support Tab ── uses hardcoded dashboard-data  │      │
└──────────────────────────────────────┬───────────────────┘
                                       │
              ┌────────────────────────▼──────────────────┐
              │  BACKEND API ROUTES                       │
              │                                          │
              │  /api/qa-metrics/live   ← Main QA endpoint│
              │  /api/qa-metrics/sync   ← Daily sync      │
              │  /api/qa-metrics-v2     ← Normalized write│
              │  /api/code-review-metrics/live ← CR (new) │
              │  /api/cache/warm        ← Cache warming   │
              │  /api/dashboard/qa      ← Static dummy    │
              │  /api/dashboard/code-review ← Static dummy│
              └─────────┬──────────────┬─────────────────┘
                        │              │
           ┌────────────▼──┐   ┌───────▼──────────┐
           │  Jira Cloud   │   │  Supabase        │
           │  REST API v3  │   │  (PostgreSQL)    │
           │  (rate-limited)│   │  - Normalized    │
           │               │   │    schema         │
           │  16 API calls │   │  - Cache pool    │
           │  per request  │   │  - Sync storage  │
           └───────────────┘   └──────────────────┘
```

---

## 3. File-by-File Reference

### Core Library Files (`lib/`)

| File | Purpose | Status |
|------|---------|--------|
| `jira-client.ts` | Jira REST API client. Auth, search, batch changelog fetch. | ✅ Working |
| `jira-workflow.ts` | QA workflow processor. Replicates n8n logic. 3 JQL queries × 4 rollback windows. Calculates cycle time, throughput, WIP, defects. | ✅ Working (with a bug — see §6) |
| `code-review-workflow.ts` | Code Review workflow processor. Same pattern as QA but tracks "Code Review" status. | ✅ Built, **untested with real data** |
| `cache-pool.ts` | Multi-layer cache: in-memory (5 min TTL) + Supabase (`pace_cache_pool` table, 24h stale fallback). Singleton `cachePool` exported. | ✅ Working |
| `dashboard-data.ts` | **~850 lines of hardcoded dummy data** for QA, Documentation, and Code Review tabs. Includes types (`Ticket`, `SnapshotMetrics`, `TeamMemberPerformance`, `AIInsight`, `EscapedBug`). | ⚠️ QA tab no longer uses this; CR and Docs tabs still do |
| `supabase.ts` | Supabase client (anon key, client-side). | ✅ |
| `chart-data.ts` | Chart data helpers for Recharts trend charts. | ✅ |
| `db.ts` | Prisma client (legacy, mostly unused). | ⚠️ Legacy |
| `api-client.ts` | Unused fetch wrapper. | ❌ Dead code |
| `qa-cache.ts` | Old simple cache (superseded by `cache-pool.ts`). | ❌ Dead code |

### API Routes (`app/api/`)

| Route | Method | Purpose | Status |
|-------|--------|---------|--------|
| `/api/qa-metrics/live` | GET | **Primary QA endpoint.** Calls Jira → processes rollback windows → returns structured data. Cache-pool enabled. | ✅ Working (rate-limit prone) |
| `/api/qa-metrics/sync` | POST | Daily sync to Supabase. Auth via `CRON_SECRET`. Stores into old `pace_qa_metrics` table (not the normalized schema). GET returns last sync timestamp. | ⚠️ Partially working (see §6) |
| `/api/qa-metrics-v2` | POST | Ingestion endpoint that writes to the **normalized** schema (`pace_qa_daily_reports`, `pace_qa_tickets`, etc.). Designed to receive data from n8n or sync. | ✅ Built, untested end-to-end |
| `/api/qa-metrics` | GET | Legacy endpoint — reads from old `pace_qa_metrics` table. | ⚠️ Legacy |
| `/api/code-review-metrics/live` | GET | Code Review live endpoint. Same pattern as QA live. Cache-pool enabled. | ✅ Built, **not wired to frontend** |
| `/api/cache/warm` | POST/GET | Cache warming endpoint. POST fetches fresh data and populates cache. GET returns cache stats. | ✅ Working |
| `/api/dashboard/qa` | GET | Returns hardcoded QA dummy data from `dashboard-data.ts`. | ⚠️ Not used by frontend anymore |
| `/api/dashboard/code-review` | GET | Returns hardcoded CR dummy data. | ⚠️ Not used |
| `/api/dashboard/documentation` | GET | Returns hardcoded Docs dummy data. | ⚠️ Not used |
| `/api/jira-test` | GET | Simple Jira connectivity test. | ✅ Utility |
| `/api/health` | GET | Health check. | ✅ Utility |
| `/api/chart/[dashboardType]` | GET | Chart data for trend analysis. | ✅ |
| `/api/team-members` | GET | Team member list. | ✅ |
| `/api/tickets` | GET/POST | Ticket CRUD (Prisma-based, mostly legacy). | ⚠️ Legacy |

### Frontend Components (`components/`)

| Component | Purpose | Data Source |
|-----------|---------|-------------|
| `pace-dashboard.tsx` | **Reusable dashboard tab** used by QA, Docs, and CR tabs. Renders metrics cards, ticket tables, daily performance, trend charts, AI insights. | Props from parent |
| `metric-card.tsx` | Individual metric card (SP Throughput, PACE, etc.). | Props |
| `ticket-table.tsx` | Critical/aging ticket table. | Props |
| `daily-performance.tsx` | Team totals + individual member performance cards. | Props |
| `pace-line-chart.tsx` | Recharts trend analysis (SP Throughput, Pace, Cycle Time, Volume, Return Rate). | Props |
| `ai-insights.tsx` | AI-generated insights panel (currently dummy data). | Props |
| `escaped-bugs.tsx` | Escaped bugs / defects table. | Props |
| `trips-summary.tsx` | TRIPS Summary aggregation view (partially wired to Jira data). | Props |
| `data-model.tsx` | Data model visualization tab. | Static |
| `infrastructure-dashboard.tsx` | Infrastructure metrics (all dummy). | Static hardcoded |
| `support-dashboard.tsx` | Support metrics (all dummy). | Static hardcoded |
| `client-knowledge-dashboard.tsx` | Client.MD knowledge base (all dummy). | Static hardcoded |
| `bug-analysis-table.tsx` | Bug analysis (dummy). | Static hardcoded |

### Main Page (`app/page.tsx`)

- **507 lines**, single-page dashboard with tabs.
- **QA tab:** Fetches from `/api/qa-metrics/live`, transforms Jira data into `PaceDashboardTab` props. This is the **only tab using real data**.
- **Code Review tab:** Uses hardcoded `crSnapshotMetrics`, `crCriticalTickets`, etc. from `dashboard-data.ts`.
- **Docs tab:** Uses hardcoded `docSnapshotMetrics`, etc.
- **TRIPS Summary:** Partially wired — receives `testingData` derived from QA rollback windows.
- **Infrastructure / Support / Client.MD:** Fully hardcoded components.
- **Date in header is hardcoded:** `February 23, 2026` (line 334).

### Database Schema (`database/schema.sql`)

**11 normalized tables + views:**

| # | Table | Purpose |
|---|-------|---------|
| 1 | `pace_qa_team_members` | Team roster (name, email, role, is_active) |
| 2 | `pace_qa_daily_reports` | One row per day (report_date, status, docs_id) |
| 3 | `pace_qa_daily_member_stats` | Per-member daily stats (tickets, SP, first/repeat pass) |
| 4 | `pace_qa_tickets` | Unique tickets (ticket_key, summary, SP, priority) |
| 5 | `pace_qa_ticket_completions` | Completion events (who, when, pass_type, stage transitions) |
| 6 | `pace_qa_wip_tickets` | WIP snapshots (age, is_critical, is_old) |
| 7 | `pace_qa_rollback_windows` | Aggregated window metrics (cycle time, throughput, WIP, defects) |
| 8 | `pace_qa_30day_summary` | 30-day aggregate metrics |
| 9 | `pace_qa_member_30day_throughput` | Per-member 30-day throughput |
| 10 | `pace_qa_insights` | AI-generated insights |
| 11 | `pace_cache_pool` | Persistent cache for API responses |

**Views:** `vw_qa_member_performance_7d`, `vw_qa_wip_summary`
**RLS Policies:** Defined but may need verification.
**Seed data:** 4 sample team members.

> **Important:** The sync endpoint (`/api/qa-metrics/sync`) currently writes to an **old denormalized table** (`pace_qa_metrics`) which is NOT in the schema.sql. The normalized v2 ingestion endpoint (`/api/qa-metrics-v2`) writes to the correct normalized tables but is not called by the sync flow.

---

## 4. Data Flow — How QA Tab Works Today

```
1. User loads dashboard
2. page.tsx useEffect → fetch('/api/qa-metrics/live')
3. /api/qa-metrics/live:
   a. Check cache pool (memory → Supabase)
   b. If cache miss → call Jira API:
      - 4 rollback windows (w7, w28, prior_w7, prior_w28)
      - 3 JQL queries each = 12 total API calls
      - Each query expands changelog
   c. Process tickets: extractQAMembers → calculate metrics
   d. Build response: { output, rollback_windows, critical_qa_wip_tickets, old_qa_wip_tickets }
   e. Cache response in pool
   f. Return JSON
4. page.tsx transforms response into PaceDashboardTab props
5. PaceDashboardTab renders metrics, tables, charts
```

### JQL Queries Per Window (n8n structure)

```sql
-- 1. Final Status: tickets that completed QA
status CHANGED TO ("Push Staging", "Push Production", "Done")
AFTER startOfDay(-N) BEFORE endOfDay(-M)

-- 2. Pushback: tickets pushed back from Done to In Progress
status CHANGED FROM ("Push Staging", "Push Production", "Done")
TO ("In Progress")
AFTER startOfDay(-N) BEFORE endOfDay(-M)

-- 3. Tracked Status (WIP): tickets entered QA and still in QA
status CHANGED TO ("Quality Assurance")
AFTER startOfDay(-N) BEFORE endOfDay(-M)
AND status IN ("Quality Assurance")
```

### Rollback Windows

| Key | Description | Days | Prior Days |
|-----|-------------|------|------------|
| `w7` | Last 7 Business Days | 7 | 0 |
| `w28` | Last 28 Business Days | 28 | 0 |
| `prior_w7` | Prior 7 Days (before w7) | 7 | 7 |
| `prior_w28` | Prior 28 Days (before w28) | 28 | 28 |

---

## 5. What Is Working ✅

1. **QA Tab — Live Jira Data:** Fetches real data from Jira, displays metrics, critical/aging tickets, daily performance per team member, and TRIPS summary.
2. **Cache Pool:** Multi-layer caching (memory + Supabase) with stale fallback on 429 errors. 5-minute TTL.
3. **Cache Warming Endpoint:** `/api/cache/warm` pre-populates the cache.
4. **Normalized Database Schema:** 11 tables designed and documented in `database/schema.sql`.
5. **V2 Ingestion Endpoint:** `/api/qa-metrics-v2` can write structured data into the normalized schema.
6. **Code Review Workflow Processor:** `lib/code-review-workflow.ts` and `/api/code-review-metrics/live` are built (same architecture as QA).
7. **Reusable Dashboard Component:** `PaceDashboardTab` is parameterized and reused across QA, Docs, and CR tabs.
8. **UI:** Polished, dark-themed dashboard with tabs, metric cards, ticket tables, daily performance breakdowns, trend charts.

---

## 6. Known Bugs & Issues 🐛

### Critical

1. **`jira-workflow.ts` line 602–620 — `searchIssues` called with 3 args but only accepts 2.**
   - `searchIssues(jql, expand, options)` — the third parameter `{ fields, maxResults }` is silently ignored because the method signature is `searchIssues(jql: string, expand?: string[])`.
   - **Impact:** Custom field selection and `maxResults=1000` are not being sent to Jira. All fields are returned (larger payloads, slower).
   - **Fix:** Update `JiraClient.searchIssues()` in `jira-client.ts` to accept an options parameter for `fields` and `maxResults`.

2. **Sync endpoint writes to wrong table.**
   - `/api/qa-metrics/sync` inserts into `pace_qa_metrics` (old denormalized table not in schema.sql).
   - Should either: (a) call `/api/qa-metrics-v2` internally, or (b) write directly to the normalized tables.

3. **`last_30_business_days` uses hardcoded estimates (70%/30% split).**
   - `app/api/qa-metrics/live/route.ts` lines 88–94: `first_qa_cycle` and `returning_qa_cycle` are calculated as `Math.round(total * 0.7)` and `Math.round(total * 0.3)` — not actual values.
   - **Fix:** Derive from actual ticket `had_previous_returns` data.

4. **`last_business_day` stats are always zeros.**
   - In `buildPeopleData()` (`live/route.ts` lines 221–228), `last_business_day_stats` and `last_business_day_tickets` are hardcoded to empty/zero.
   - The n8n workflow had a separate query for last business day tickets — this was never implemented.
   - **Impact:** "Previous Day" column in daily performance always shows 0.

5. **Rate limiting is frequent.**
   - 12 Jira API calls per request (3 queries × 4 windows), all with `expand=changelog`.
   - Jira Cloud rate limit is ~10 requests/second, but changelogs are expensive.
   - **Mitigation in place:** Cache pool with stale fallback. But first load after cache expiry still triggers all 12 calls.

### Non-Critical

6. **Header date is hardcoded** to "February 23, 2026" in `page.tsx` line 334.

7. **`processAllWindows()` in `jira-workflow.ts` runs windows sequentially** (line 663: `for...of` with `await`). Could parallelize w7+prior_w7 and w28+prior_w28 since they're independent.

8. **`buildJQL()` method in `jira-workflow.ts` (line 572)** is defined but never called — dead code.

9. **Duplicate `createClient` import** in `sync/route.ts` — imported at top (line 2) and dynamically imported again (line 89).

10. **`qa-cache.ts`** and **`api-client.ts`** are dead code (superseded by `cache-pool.ts`).

11. **Prisma** is configured (`prisma/`, `postinstall` script) but not used for any active feature. Legacy from an earlier phase.

---

## 7. What Is NOT Done Yet ❌

### High Priority

| # | Task | Details |
|---|------|---------|
| 1 | **Wire Code Review tab to live Jira data** | Backend exists (`/api/code-review-metrics/live`). Frontend (`page.tsx` lines 458–481) still uses hardcoded `crSnapshotMetrics` etc. from `dashboard-data.ts`. Need to: (a) add `useEffect` fetch like QA tab, (b) transform response, (c) pass to `PaceDashboardTab`. |
| 2 | **Fix sync endpoint to use normalized schema** | `/api/qa-metrics/sync` currently writes to `pace_qa_metrics` (doesn't exist in schema). Should write to normalized tables or call v2 endpoint. |
| 3 | **Implement backfill endpoint** | Was planned but the file doesn't exist (`app/api/qa-metrics/backfill/route.ts` is missing). Need to create it to populate historical data into Supabase. |
| 4 | **Fix `last_business_day` data** | Need a separate JQL query for the previous business day's tickets, or derive from `prior_w7` window data. Currently always returns zeros. |
| 5 | **Fix `first_qa_cycle` / `returning_qa_cycle` estimates** | Replace 70%/30% hardcoded split with actual `had_previous_returns` breakdown. |
| 6 | **Fix `searchIssues` to accept 3rd options param** | Update `jira-client.ts` to pass `fields` and `maxResults` to Jira API. |

### Medium Priority

| # | Task | Details |
|---|------|---------|
| 7 | **Dashboard reads from Supabase instead of live Jira** | The original plan was: daily sync populates Supabase → dashboard reads from Supabase (fast, no rate limits) → manual refresh for on-demand. Currently dashboard always hits Jira live. |
| 8 | **Setup Vercel cron** | Need `vercel.json` with cron config for daily sync at 6 AM EST + cache warming at 6:05 AM. |
| 9 | **Add manual refresh button** | UI button to trigger `/api/qa-metrics/sync` on-demand. |
| 10 | **Wire Documentation tab to Jira** | Similar to Code Review — need to identify which Jira statuses map to "Documentation" and build a workflow processor. |
| 11 | **Trend chart data from real data** | `pace-line-chart.tsx` currently uses static chart data from `chart-data.ts`. Should query historical data from Supabase. |
| 12 | **AI Insights** | `pace_qa_insights` table exists in schema. No AI integration implemented yet. Could use OpenAI to generate daily insights from metrics. |

### Low Priority

| # | Task | Details |
|---|------|---------|
| 13 | **Infrastructure dashboard** | Fully hardcoded. Needs data source. |
| 14 | **Support dashboard** | Fully hardcoded. Needs data source. |
| 15 | **Client.MD dashboard** | Fully hardcoded. Needs data source. |
| 16 | **Clean up dead code** | Remove `qa-cache.ts`, `api-client.ts`, unused `buildJQL()`, duplicate imports. |
| 17 | **Remove Prisma** | Not used. Remove `prisma/`, `db.ts`, and related `package.json` scripts. |
| 18 | **Dynamic header date** | Replace hardcoded "February 23, 2026" with `new Date()`. |

---

## 8. Recommended Next Steps (Priority Order)

### Phase 1: Fix Critical Bugs

1. **Update `jira-client.ts`** — Add `options?: { fields?: string; maxResults?: number }` to `searchIssues()`.
2. **Fix 70/30 estimate** — Calculate actual first-pass vs repeat-pass from ticket data.
3. **Fix previous day stats** — Add query or derive from `prior_w7` data.
4. **Fix header date** — Make it dynamic.

### Phase 2: Complete Data Persistence

5. **Rewrite sync endpoint** to use normalized schema (call v2 ingestion logic).
6. **Create backfill endpoint** (it's missing from the filesystem).
7. **Run backfill** to populate 30+ days of historical data.
8. **Create a Supabase-read endpoint** — `/api/qa-metrics/db` that reads from normalized tables.
9. **Update dashboard** to prefer Supabase data, fallback to live Jira if stale.

### Phase 3: Wire Remaining Tabs

10. **Wire Code Review tab** to `/api/code-review-metrics/live`.
11. **Wire Documentation tab** (may need a new workflow processor for Doc statuses).
12. **Wire trend charts** to historical Supabase data.
13. **Setup Vercel cron** for daily sync + cache warming.

### Phase 4: Polish

14. Add manual refresh button.
15. Add AI insights integration.
16. Clean up dead code and legacy Prisma.
17. Add error boundaries and loading states for all tabs.

---

## 9. Key Jira Configuration

- **Jira instance:** `https://callplaybook.atlassian.net`
- **Projects:** `"Playbook SaaS - Scrum"`, `"PlayBook App"`
- **QA Status:** `"Quality Assurance"` (tracked in `COUNTED_STATUS`)
- **Code Review Status:** `"Code Review"`
- **Final Statuses:** `"Push Staging"`, `"Push Production"`, `"Done"`
- **Pushback Status:** `"In Progress"`
- **Story Points field:** `customfield_10028`
- **Developer field:** `customfield_10034`
- **Auth:** Basic auth (email + API token, base64 encoded)
- **API:** Uses new `/rest/api/3/search/jql` endpoint (not deprecated `/rest/api/2/search`)

---

## 10. Rate Limiting Strategy

**Current approach:**
- 12 API calls per dashboard load (3 queries × 4 windows)
- In-memory cache: 5-minute TTL
- Supabase cache: persistent, 5-min fresh / 24-hour stale
- On 429 error: serve stale cache

**Recommended improvements:**
- Parallelize independent windows (w7 + prior_w7 can run simultaneously)
- Reduce to 2 windows on initial load (w7 + w28), lazy-load priors
- Implement exponential backoff on 429
- Move to Supabase-first reads (eliminates Jira calls for dashboard loads entirely)
- Use Jira webhooks instead of polling (if available)

---

## 11. Type Definitions Reference

Key interfaces in `lib/jira-workflow.ts`:

```typescript
RollbackWindow { title, key, days, prior_days }
RollbackWindowData { rollback_window_description, cycle_time, qa_in_progress, defects, throughput }
CycleTimeMetrics { to_qa_avg_bd, to_done_avg_bd, to_pushback_avg_bd }
ThroughputMetrics { total_story_points, total_tickets, per_qa_member_throughput[] }
WIPMetrics { total_tickets, total_story_points, old_qa_wip_tickets[], critical_qa_wip_tickets[], per_qa_member_qa_in_progress[] }
DefectMetrics { escaped_defects_count, critical_defects: { total_count, unresolved_count, resolved_count, old_unresolved[] } }
```

Key interfaces in `lib/dashboard-data.ts`:

```typescript
SnapshotMetrics { spThroughput, pace, assignedVolume, qCycle, tCycle, rAgeCycle, escapedDefects, critBugs }
Ticket { key, recentAge, age, sp, assignee, developer, returnCount, firstQA, latestQA, status, summary }
TeamMemberPerformance { name, today, previousDay, weekly, monthly, dailyRhythm, activities[] }
AIInsight { ... }
EscapedBug { ... }
```

---

## 12. How to Run

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev
# → http://localhost:3000

# Build for production
pnpm build

# Test Jira connectivity
curl http://localhost:3000/api/jira-test

# Test QA live endpoint
curl http://localhost:3000/api/qa-metrics/live

# Check cache status
curl http://localhost:3000/api/cache/warm

# Warm cache manually
curl -X POST http://localhost:3000/api/cache/warm \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Trigger sync manually
curl -X POST http://localhost:3000/api/qa-metrics/sync \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## 13. Files You'll Touch Most

For continuing development, these are the key files ordered by likely frequency of changes:

1. **`app/page.tsx`** — Main dashboard, data transformation, tab wiring
2. **`lib/jira-workflow.ts`** — Core QA processing logic
3. **`lib/jira-client.ts`** — Jira API client (needs `fields`/`maxResults` fix)
4. **`app/api/qa-metrics/live/route.ts`** — Primary API endpoint
5. **`app/api/qa-metrics/sync/route.ts`** — Daily sync (needs rewrite)
6. **`lib/code-review-workflow.ts`** — CR processor (needs testing)
7. **`components/pace-dashboard.tsx`** — Reusable dashboard component
8. **`lib/dashboard-data.ts`** — Hardcoded data to be replaced
9. **`database/schema.sql`** — Database schema reference

---

*End of handoff document.*
