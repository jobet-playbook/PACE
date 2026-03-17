# PACE Dashboard — Agent Handoff Document

> **Last updated:** March 17, 2026
> **Purpose:** Comprehensive summary for a new agent to continue development.

---

## 1. Project Overview

**PACE** is a Next.js 16 dashboard tracking engineering team performance across five TRIPS domains:

| Tab | Data Source | Status |
|-----|-------------|--------|
| **T** - Testing / QA | Live Jira → Normalized Supabase → Cache | ✅ Working |
| **R** - Code Review | Hardcoded dummy data | ⚠️ Backend built, frontend not wired |
| **P** - PRD / Docs | Hardcoded dummy data | ❌ Not started |
| **I** - Infrastructure | Hardcoded dummy data | ❌ Not started |
| **S** - Support | Hardcoded dummy data | ❌ Not started |

Additional tabs: **TRIPS Summary** (partially wired to QA), **Client.MD** (hardcoded), **Data Model** (static).

### Tech Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **UI:** Tailwind CSS 4, shadcn/ui, Recharts, Lucide icons
- **Database:** Supabase (PostgreSQL) — 11 normalized `pace_qa_*` tables + `pace_cache_pool`
- **External API:** Jira Cloud REST API v3 (`/rest/api/3/search/jql`)
- **Caching:** Multi-layer (in-memory 5min TTL + Supabase 24h stale fallback)
- **Legacy ORM:** Prisma — configured but unused
- **Deployment:** Vercel (cron: weekday sync at 11:00 UTC)

### Environment Variables (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
JIRA_BASE_URL=https://callplaybook.atlassian.net
JIRA_EMAIL=...
JIRA_API_TOKEN=...
CRON_SECRET=...              # Bearer token for sync/cache-warm auth
DATABASE_URL=file:./dev.db   # Prisma (legacy, unused)
```

---

## 2. Architecture

```
FRONTEND (app/page.tsx — 507 lines, single-page dashboard)
  ├─ QA Tab ──────── fetches /api/qa-metrics/live
  ├─ CR Tab ──────── hardcoded dashboard-data.ts
  ├─ Docs Tab ────── hardcoded dashboard-data.ts
  ├─ Infra/Support/Client.MD ── hardcoded components
  ├─ TRIPS Summary ─ partially wired (QA data)
  └─ Data Model ──── static

BACKEND API
  /api/qa-metrics/live   ← 3-tier: cache → DB → Jira
  /api/qa-metrics/sync   ← Cron: Jira → writeToNormalizedTables()
  /api/code-review-metrics/live  ← Built, not wired
  /api/cache/warm        ← Cache warming
  /api/qa-metrics-v2     ← V2 ingestion (superseded)
  /api/dashboard/*       ← Legacy dummy endpoints

EXTERNAL
  Jira Cloud (12 API calls per full fetch)
  Supabase PostgreSQL (11 pace_qa_* tables + cache)
```

---

## 3. Library Files (`lib/`)

| File | Purpose | Status |
|------|---------|--------|
| `jira-client.ts` (4.3KB) | Jira REST client. `searchIssues(jql, expand?, options?)` accepts fields/maxResults. | ✅ |
| `jira-workflow.ts` (21.7KB) | QA processor. 3 JQL × 4 windows. Cycle time, throughput, WIP, defects. | ✅ |
| `code-review-workflow.ts` (11.1KB) | CR processor. Same pattern, tracks "Code Review" status. | ✅ Built, untested |
| `qa-metrics-db.ts` (19.3KB) | Normalized DB read/write. `writeToNormalizedTables()` + `readFromNormalizedTables()`. | ✅ |
| `cache-pool.ts` (7.5KB) | Multi-layer cache. Singleton `cachePool` + `CacheKeys`. | ✅ |
| `dashboard-data.ts` (57.4KB) | Hardcoded dummy data for CR + Docs tabs. Types exported. | ⚠️ CR/Docs only |
| `chart-data.ts` (6.6KB) | Static chart data for Recharts. | ✅ |
| `supabase.ts` (338B) | Supabase client (anon key). | ✅ |
| `utils.ts` (166B) | `cn()` utility. | ✅ |
| `db.ts` (279B) | Prisma client. | ⚠️ Legacy |
| `api-client.ts` (661B) | Unused fetch wrapper. | ❌ Dead |
| `qa-cache.ts` (578B) | Old cache, superseded. | ❌ Dead |

---

## 4. API Routes (`app/api/`)

| Route | Method | Purpose | Status |
|-------|--------|---------|--------|
| `/api/qa-metrics/live` | GET | **Primary.** 3-tier: memory → DB → Jira. Writes to normalized tables on Jira fetch. | ✅ |
| `/api/qa-metrics/sync` | POST/GET | Cron sync → `writeToNormalizedTables()`. GET returns last sync time. | ✅ |
| `/api/code-review-metrics/live` | GET | CR endpoint, cache-pool enabled. | ✅ Not wired to UI |
| `/api/cache/warm` | POST/GET | Cache warming / stats. | ✅ |
| `/api/qa-metrics-v2` | POST | V2 ingestion (superseded by qa-metrics-db.ts). | ⚠️ |
| `/api/qa-metrics` | GET/POST | Legacy denormalized. | ⚠️ Legacy |
| `/api/dashboard/*` | GET | Hardcoded dummy endpoints. | ⚠️ Unused |
| `/api/jira-test` | GET | Jira connectivity test. | ✅ |
| `/api/health` | GET | Health check. | ✅ |
| `/api/chart/[type]` | GET | Chart data. | ✅ |
| `/api/team-members` | GET | Team member list. | ✅ |
| `/api/tickets` | GET/POST | Prisma-based CRUD. | ⚠️ Legacy |

---

## 5. Frontend Components (`components/`)

| Component | Purpose |
|-----------|---------|
| `pace-dashboard.tsx` (12.5KB) | **Reusable tab** — metrics, tables, performance, charts, insights |
| `trips-summary.tsx` (17.7KB) | TRIPS aggregation (QA data only) |
| `daily-performance.tsx` (13.9KB) | Team totals + member cards |
| `pace-line-chart.tsx` (12.7KB) | Recharts trend analysis |
| `metric-card.tsx` (2.1KB) | Individual metric card |
| `ticket-table.tsx` (3.5KB) | Critical/aging ticket table |
| `ai-insights.tsx` (7.7KB) | AI insights panel |
| `escaped-bugs.tsx` (12.9KB) | Defects table |
| `data-model.tsx` (22.9KB) | Schema visualization |
| `infrastructure-dashboard.tsx` (15.6KB) | Hardcoded |
| `support-dashboard.tsx` (20.2KB) | Hardcoded |
| `client-knowledge-dashboard.tsx` (15.9KB) | Hardcoded |
| `bug-analysis-table.tsx` (11.1KB) | Hardcoded |
| `ui/` (57 items) | shadcn/ui primitives |

---

## 6. Database Schema (11 tables + cache)

| # | Table | Purpose |
|---|-------|---------|
| 1 | `pace_qa_team_members` | Team roster (name unique, email, role, is_active) |
| 2 | `pace_qa_daily_reports` | Daily metadata (report_date unique, status, docs_id) |
| 3 | `pace_qa_daily_member_stats` | Per-member daily stats (FK report+member) |
| 4 | `pace_qa_tickets` | Ticket master (ticket_key unique, summary, SP) |
| 5 | `pace_qa_ticket_completions` | Completion events (FK ticket+member+report) |
| 6 | `pace_qa_wip_tickets` | WIP snapshots (age, is_critical, is_old) |
| 7 | `pace_qa_rollback_windows` | Window aggregates (cycle time, throughput, defects) |
| 8 | `pace_qa_30day_summary` | 30-day aggregates (FK report) |
| 9 | `pace_qa_member_30day_throughput` | Per-member 30-day (FK summary+member) |
| 10 | `pace_qa_insights` | AI insights (JSONB points/actions) |
| 11 | `pace_cache_pool` | Persistent API cache (JSONB data, cached_at) |

**Views:** `vw_qa_member_performance_7d`, `vw_qa_wip_summary`, `vw_qa_throughput_trend`
**Functions:** `calculate_member_pace()`, `get_latest_report_summary()`
**RLS:** Read=authenticated, Write=service role.
**Legacy:** `pace_qa_metrics` (denormalized, no longer written to).

---

## 7. Data Flow — QA Tab

```
User loads dashboard
  → fetch('/api/qa-metrics/live')
  → Tier 1: Memory cache (5min TTL) → HIT? Return.
  → Tier 2: readFromNormalizedTables() (<23h) → HIT? Warm cache, return.
  → Tier 3: Jira live
      processAllWindows(): 4 windows × 3 JQL (parallel per window)
      → extractQAMembers → calculate metrics
      → Deduplicate WIP tickets
      → Build last_30_business_days (actual first/repeat from w28)
      → Build people from w7 throughput
      → writeToNormalizedTables() (async)
      → Warm cache → Return
  → On 429: stale cache fallback (24h)
```

### Rollback Windows

| Key | Description | Days | Prior |
|-----|-------------|------|-------|
| `w7` | Last 7 BD | 7 | 0 |
| `w28` | Last 28 BD | 28 | 0 |
| `prior_w7` | Prior 7 BD | 7 | 7 |
| `prior_w28` | Prior 28 BD | 28 | 28 |

### JQL Per Window (3 queries)

1. **Final Status** — tickets changed TO "Push Staging"/"Push Production"/"Done"
2. **Pushback** — tickets changed FROM final TO "In Progress"
3. **Tracked WIP** — tickets changed TO "Quality Assurance" AND still IN it

---

## 8. What Is Working ✅

1. QA Tab with 3-tier read (cache → normalized DB → Jira)
2. Sync endpoint writes to normalized `pace_qa_*` tables
3. Live endpoint reads from normalized tables when fresh (<23h)
4. `searchIssues()` accepts `fields`/`maxResults` options
5. `last_30_business_days` uses actual first/repeat breakdown (not 70/30)
6. Multi-layer cache with stale fallback on 429
7. Cache warming endpoint
8. Full normalized schema (11 tables + views + functions)
9. `qa-metrics-db.ts` read/write layer with FK ordering
10. Code Review backend built
11. Reusable `PaceDashboardTab` component
12. Vercel cron for weekday sync
13. CORS middleware for API routes

---

## 9. Known Bugs 🐛

### Critical

1. **`last_business_day` always zeros** — `buildPeopleData()` in both `live/route.ts` (line 205) and `sync/route.ts` (line 254) hardcodes previous day stats to zero. n8n had a separate query for this. **Fix:** query for prior BD or extract from `prior_w7`.

2. **Rate limiting on cold loads** — 12 Jira calls on Jira-path. Mitigated by 3-tier read but first load after 23h+ gap is expensive. **Fix:** parallelize windows, add cache warm to cron.

3. **Duplicate `buildPeopleData()`** — identical in `live/route.ts` and `sync/route.ts`. Should be in shared module. `getLastBusinessDay()` also duplicated (exported from `qa-metrics-db.ts` but `sync/route.ts` has its own copy).

### Non-Critical

4. **Header date hardcoded** — `"February 23, 2026"` at `page.tsx` line 334.
5. **`processAllWindows()` sequential** — could parallelize independent window pairs.
6. **Dead code** — `qa-cache.ts`, `api-client.ts`.
7. **Prisma unused** — `prisma/`, `db.ts`, postinstall script.
8. **Unused `supabase` import** in `page.tsx` line 28.

---

## 10. What Is NOT Done ❌

### High Priority

1. **Wire Code Review tab to live data** — Backend exists. Frontend uses hardcoded data.
2. **Fix `last_business_day` data** — Always zeros currently.
3. **Consolidate duplicate helpers** — `buildPeopleData()`, `getLastBusinessDay()`.
4. **Create backfill endpoint** — `app/api/qa-metrics/backfill/route.ts` missing.

### Medium Priority

5. Add cache warming to Vercel cron (after sync).
6. Manual refresh button in UI.
7. Wire Documentation tab to Jira.
8. Trend charts from real historical Supabase data.
9. AI Insights integration (`pace_qa_insights` table ready).
10. Parallelize rollback window processing.

### Low Priority

11. Infrastructure/Support/Client.MD dashboards — need data sources.
12. Clean up dead code (`qa-cache.ts`, `api-client.ts`).
13. Remove Prisma.
14. Dynamic header date.
15. Remove legacy endpoints (`/api/qa-metrics`, `/api/dashboard/*`).

---

## 11. Recommended Next Steps

**Phase 1 — Bugs:** Fix last_business_day zeros, consolidate duplicates, dynamic header date.

**Phase 2 — Tabs:** Wire Code Review tab, wire Documentation tab, wire trend charts to DB.

**Phase 3 — Operations:** Cache warming cron, backfill endpoint, manual refresh button, parallelize windows.

**Phase 4 — Polish:** AI insights, dead code cleanup, remove Prisma, error boundaries, remaining dashboards.

---

## 12. Jira Configuration

| Setting | Value |
|---------|-------|
| Instance | `https://callplaybook.atlassian.net` |
| Projects | `"Playbook SaaS - Scrum"`, `"PlayBook App"` |
| QA Status | `"Quality Assurance"` |
| CR Status | `"Code Review"` |
| Final Statuses | `"Push Staging"`, `"Push Production"`, `"Done"` |
| Pushback | `"In Progress"` |
| Story Points | `customfield_10028` |
| Developer | `customfield_10034` |
| Auth | Basic (email:token base64) |
| API | `/rest/api/3/search/jql` |

---

## 13. Type Definitions

### `lib/jira-workflow.ts`

```typescript
RollbackWindow { title, key, days, prior_days }
RollbackWindowData { rollback_window_description, cycle_time, qa_in_progress, defects, throughput }
CycleTimeMetrics { to_qa_avg_bd, to_done_avg_bd, to_pushback_avg_bd }
ThroughputMetrics { total_story_points, total_qa_phase_story_points, total_tickets, per_qa_member_throughput[] }
WIPMetrics { total_tickets, total_story_points, old_qa_wip_tickets[], critical_qa_wip_tickets[] }
DefectMetrics { escaped_defects_count, critical_defects: { total_count, unresolved_count, resolved_count } }
```

### `lib/dashboard-data.ts`

```typescript
SnapshotMetrics { spThroughput, pace, assignedVolume, qCycle, tCycle, rAgeCycle, escapedDefects, critBugs }
Ticket { key, recentAge, age, sp, assignee, developer, returnCount, firstQA, latestQA, status, summary }
TeamMemberPerformance { name, today, previousDay, weekly, monthly, dailyRhythm, activities[] }
```

---

## 14. How to Run

```bash
pnpm install
pnpm dev                    # → http://localhost:3000

# Test endpoints
curl http://localhost:3000/api/jira-test
curl http://localhost:3000/api/qa-metrics/live
curl http://localhost:3000/api/cache/warm
curl http://localhost:3000/api/qa-metrics/sync          # GET: last sync time

# Manual operations
curl -X POST http://localhost:3000/api/cache/warm \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
curl -X POST http://localhost:3000/api/qa-metrics/sync \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
curl http://localhost:3000/api/code-review-metrics/live  # CR backend test
```

---

## 15. Key Files (by edit frequency)

1. `app/page.tsx` — Dashboard, data transform, tab wiring
2. `app/api/qa-metrics/live/route.ts` — Primary 3-tier endpoint
3. `app/api/qa-metrics/sync/route.ts` — Cron sync
4. `lib/jira-workflow.ts` — QA processing (694 lines)
5. `lib/qa-metrics-db.ts` — Normalized DB layer (477 lines)
6. `lib/jira-client.ts` — Jira API client
7. `lib/code-review-workflow.ts` — CR processor
8. `components/pace-dashboard.tsx` — Reusable dashboard
9. `lib/dashboard-data.ts` — Hardcoded data (to be replaced)
10. `database/schema.sql` — Schema reference

---

## 16. Related Docs

| Doc | Contents |
|-----|----------|
| `README.md` | General overview (partially outdated, references Prisma) |
| `API.md` | API reference (covers legacy endpoints) |
| `CACHE_POOL.md` | Cache architecture, TTL config, troubleshooting |
| `CODE_REVIEW_SETUP.md` | CR metrics, API response structure, frontend integration guide |
| `JIRA_INTEGRATION_GUIDE.md` | Jira setup, JQL queries, n8n migration |
| `N8N_INTEGRATION.md` | n8n webhook data format (legacy reference) |
| `SUPABASE_SETUP.md` | Supabase setup (references old denormalized table) |
| `SETUP.md` | Quick start (Prisma-focused, outdated) |
| `database/README.md` | Normalized schema docs, common queries, maintenance |
| `database/TABLE_NAMES.md` | Quick ref for `pace_`-prefixed tables |
| `database/N8N_DATA_MAPPING.md` | n8n output → normalized table column mapping |
| `database/MIGRATION_GUIDE.md` | Migration from old schema with rollback procedures |

---

## 17. Configuration Files

| File | Purpose |
|------|---------|
| `vercel.json` | Cron: sync weekdays 11:00 UTC |
| `middleware.ts` | CORS for `/api/*` |
| `package.json` | Deps + legacy Prisma scripts |
| `components.json` | shadcn/ui config |
| `tsconfig.json` | TS config with `@/` alias |
| `.env.example` | Env var template |
| `.gitignore` | Standard Next.js ignores |

---

*End of handoff document.*
