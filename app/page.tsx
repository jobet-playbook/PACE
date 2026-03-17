"use client"

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { PaceDashboardTab } from "@/components/pace-dashboard"
import {
  docSnapshotMetrics,
  docCriticalTickets,
  docAgingTickets,
  docDailyPerformance,
  docTeamMemberPerformance,
  docAllStatuses,
  crSnapshotMetrics,
  crCriticalTickets,
  crAgingTickets,
  crDailyPerformance,
  crTeamMemberPerformance,
  crAllStatuses,
  docAIInsights,
  crAIInsights,
} from "@/lib/dashboard-data"
import { TripsSummary } from "@/components/trips-summary"
import { DataModel } from "@/components/data-model"
import { InfrastructureDashboard } from "@/components/infrastructure-dashboard"
import { SupportDashboard } from "@/components/support-dashboard"
import { ClientKnowledgeDashboard } from "@/components/client-knowledge-dashboard"
import { ShieldCheck, FileText, GitPullRequest, Layers, Database, Server, Headphones, BookOpen } from "lucide-react"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export default function DashboardPage() {
  const [qaData, setQaData] = useState<any>(null)
  const [qaLoading, setQaLoading] = useState(true)
  const [testingData, setTestingData] = useState<any>(null)
  const [crData, setCrData] = useState<any>(null)
  const [crLoading, setCrLoading] = useState(true)

  useEffect(() => {
    async function fetchQAData() {
      try {
        console.log('🔍 Fetching live QA data from Jira...')
        
        // Fetch live data from Jira API endpoint
        const response = await fetch('/api/qa-metrics/live')
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          console.error('❌ Failed to fetch live data:', response.statusText, errorData)
          
          // Store error message for display
          setQaData({ 
            error: true, 
            message: errorData.message || 'Failed to fetch live data from Jira',
            instructions: errorData.instructions 
          })
          setQaLoading(false)
          return
        }

        const latestRecord = await response.json()
        console.log('✅ Live data fetched from Jira:', latestRecord)

        // Check if we got valid data
        if (!latestRecord || !latestRecord.output || !latestRecord.rollback_windows) {
          console.error('❌ Invalid data structure received from API')
          setQaData({ 
            error: true, 
            message: 'Invalid data received from Jira API',
            instructions: 'Please refresh the page to try again'
          })
          setQaLoading(false)
          return
        }

        // Transform the data for the dashboard
        const { output, critical_qa_wip_tickets, old_qa_wip_tickets } = latestRecord

        const { rollback_windows } = latestRecord
        
        const transformedData = {
          metrics: {
            spThroughput: {
              last7: rollback_windows?.w7?.throughput?.total_story_points || output?.today_overview?.total_story_points || 0,
              last7Delta: 0,
              last28: rollback_windows?.w28?.throughput?.total_story_points || 0,
              last28Delta: 0,
              prior7: output?.last_business_day_overview?.total_story_points || 0,
              prior28: rollback_windows?.prior_w28?.throughput?.total_story_points || 0,
            },
            pace: {
              last7: Math.round(rollback_windows?.w7?.throughput?.total_qa_phase_story_points || 0),
              last28: Math.round(rollback_windows?.w28?.throughput?.total_qa_phase_story_points || 0),
            },
            assignedVolume: {
              totalTickets: rollback_windows?.w7?.qa_in_progress?.total_tickets || (critical_qa_wip_tickets?.length || 0) + (old_qa_wip_tickets?.length || 0),
              totalSP: rollback_windows?.w7?.qa_in_progress?.total_story_points || 0,
              agingOver7: rollback_windows?.w7?.qa_in_progress?.old_qa_wip_tickets?.length || old_qa_wip_tickets?.length || 0,
            },
            qCycle: { 
              last7: rollback_windows?.w7?.cycle_time?.to_qa_avg_bd || 0, 
              last28: rollback_windows?.w28?.cycle_time?.to_qa_avg_bd || 0 
            },
            tCycle: { 
              last7: rollback_windows?.w7?.cycle_time?.to_done_avg_bd || 0, 
              last28: rollback_windows?.w28?.cycle_time?.to_done_avg_bd || 0 
            },
            rAgeCycle: { 
              last7: rollback_windows?.w7?.cycle_time?.to_pushback_avg_bd || 0, 
              last28: rollback_windows?.w28?.cycle_time?.to_pushback_avg_bd || 0 
            },
            escapedDefects: rollback_windows?.w28?.defects?.escaped_defects_count || 0,
            critBugs: {
              open: rollback_windows?.w28?.defects?.critical_defects?.unresolved_count || critical_qa_wip_tickets?.length || 0,
              resolved: rollback_windows?.w28?.defects?.critical_defects?.resolved_count || 0,
            },
          },
          criticalTickets: critical_qa_wip_tickets?.map((ticket: any) => ({
            key: ticket.ticket_key,
            recentAge: ticket.recent_age_bd,
            age: ticket.age_bd,
            sp: ticket.story_points,
            assignee: ticket.assignee,
            developer: ticket.developer,
            returnCount: ticket.qa_repetition_count,
            firstQA: ticket.initial_qa_date,
            latestQA: ticket.latest_qa_date,
            status: ticket.qa_status,
            summary: ticket.summary,
          })) || [],
          agingTickets: old_qa_wip_tickets?.map((ticket: any) => ({
            key: ticket.ticket_key,
            recentAge: ticket.recent_age_bd,
            age: ticket.age_bd,
            sp: ticket.story_points,
            assignee: ticket.assignee,
            developer: ticket.developer,
            returnCount: ticket.qa_repetition_count,
            firstQA: ticket.initial_qa_date,
            latestQA: ticket.latest_qa_date,
            status: ticket.qa_status,
            summary: ticket.summary,
          })) || [],
          dailyPerformance: {
            today: {
              date: output?.report_meta?.today_label || new Date().toLocaleDateString(),
              tickets: output?.people?.reduce((sum: number, p: any) => sum + (p.today_stats?.ticket_count || 0), 0) || 0,
              sp: output?.people?.reduce((sum: number, p: any) => sum + (p.today_stats?.story_points || 0), 0) || 0,
              firstPass: output?.people?.reduce((sum: number, p: any) => sum + (p.today_stats?.first_time_count || 0), 0) || 0,
              firstPassSP: output?.people?.reduce((sum: number, p: any) => {
                const fpTickets = p.today_tickets?.filter((t: any) => t.pass_type === 'first_time_pass') || []
                return sum + fpTickets.reduce((s: number, t: any) => s + (t.story_points || 0), 0)
              }, 0) || 0,
              repeatPass: output?.people?.reduce((sum: number, p: any) => sum + (p.today_stats?.repeat_count || 0), 0) || 0,
              repeatPassSP: output?.people?.reduce((sum: number, p: any) => {
                const rpTickets = p.today_tickets?.filter((t: any) => t.pass_type === 'repeat_pass') || []
                return sum + rpTickets.reduce((s: number, t: any) => s + (t.story_points || 0), 0)
              }, 0) || 0,
            },
            previous: {
              date: output?.report_meta?.last_business_day_label || '',
              tickets: output?.people?.reduce((sum: number, p: any) => sum + (p.last_business_day_stats?.ticket_count || 0), 0) || 0,
              sp: output?.people?.reduce((sum: number, p: any) => sum + (p.last_business_day_stats?.story_points || 0), 0) || 0,
              firstPass: output?.people?.reduce((sum: number, p: any) => sum + (p.last_business_day_stats?.first_time_count || 0), 0) || 0,
              firstPassSP: output?.people?.reduce((sum: number, p: any) => {
                const fpTickets = p.last_business_day_tickets?.filter((t: any) => t.pass_type === 'first_time_pass') || []
                return sum + fpTickets.reduce((s: number, t: any) => s + (t.story_points || 0), 0)
              }, 0) || 0,
              repeatPass: output?.people?.reduce((sum: number, p: any) => sum + (p.last_business_day_stats?.repeat_count || 0), 0) || 0,
              repeatPassSP: output?.people?.reduce((sum: number, p: any) => {
                const rpTickets = p.last_business_day_tickets?.filter((t: any) => t.pass_type === 'repeat_pass') || []
                return sum + rpTickets.reduce((s: number, t: any) => s + (t.story_points || 0), 0)
              }, 0) || 0,
            },
            last30BD: {
              tickets: latestRecord.last_30_business_days?.total_tickets || 0,
              sp: latestRecord.last_30_business_days?.story_points || 0,
              firstPass: latestRecord.last_30_business_days?.first_qa_cycle?.ticket_count || 0,
              repeatPass: latestRecord.last_30_business_days?.returning_qa_cycle?.ticket_count || 0,
              repeatPassSP: latestRecord.last_30_business_days?.returning_qa_cycle?.story_points || 0,
            },
          },
          teamMembers: output?.people?.map((person: any) => {
            // Calculate SP breakdown for today
            const todayFirstPassTickets = person.today_tickets?.filter((t: any) => t.pass_type === 'first_time_pass') || []
            const todayRepeatPassTickets = person.today_tickets?.filter((t: any) => t.pass_type === 'repeat_pass') || []
            const todayFirstPassSP = todayFirstPassTickets.reduce((sum: number, t: any) => sum + (t.story_points || 0), 0)
            const todayRepeatPassSP = todayRepeatPassTickets.reduce((sum: number, t: any) => sum + (t.story_points || 0), 0)
            
            // Calculate SP breakdown for previous day
            const prevFirstPassTickets = person.last_business_day_tickets?.filter((t: any) => t.pass_type === 'first_time_pass') || []
            const prevRepeatPassTickets = person.last_business_day_tickets?.filter((t: any) => t.pass_type === 'repeat_pass') || []
            const prevFirstPassSP = prevFirstPassTickets.reduce((sum: number, t: any) => sum + (t.story_points || 0), 0)
            const prevRepeatPassSP = prevRepeatPassTickets.reduce((sum: number, t: any) => sum + (t.story_points || 0), 0)
            
            // Find weekly data from w7 rollback window
            const weeklyData = rollback_windows?.w7?.throughput?.per_qa_member_throughput?.find(
              (m: any) => m.qa_name === person.qa_assignee
            )
            
            // Find WIP data for this member
            const wipData = rollback_windows?.w7?.qa_in_progress?.per_qa_member_qa_in_progress?.find(
              (m: any) => m.qa_assignee === person.qa_assignee
            )
            
            return {
              name: person.qa_assignee,
              today: {
                tickets: person.today_stats.ticket_count,
                sp: person.today_stats.story_points,
                firstPass: person.today_stats.first_time_count,
                firstPassSP: todayFirstPassSP,
                repeatPass: person.today_stats.repeat_count,
                repeatPassSP: todayRepeatPassSP,
                churn: person.today_stats.repeat_percentage,
              },
              previousDay: {
                tickets: person.last_business_day_stats?.ticket_count || 0,
                sp: person.last_business_day_stats?.story_points || 0,
                firstPass: person.last_business_day_stats?.first_time_count || 0,
                firstPassSP: prevFirstPassSP,
                repeatPass: person.last_business_day_stats?.repeat_count || 0,
                repeatPassSP: prevRepeatPassSP,
                churn: person.last_business_day_stats?.repeat_percentage || 0,
              },
              weekly: {
                tickets: weeklyData?.unique_ticket_count || 0,
                sp: weeklyData?.unique_ticket_story_points || 0,
                firstPass: (weeklyData?.tickets ?? []).filter((t: any) => !t.had_previous_returns).length,
                repeatPass: (weeklyData?.tickets ?? []).filter((t: any) => t.had_previous_returns).length,
                avgCycleTime: 0,
              },
              monthly: (() => {
                const monthlyData = rollback_windows?.w28?.throughput?.per_qa_member_throughput?.find(
                  (m: any) => m.qa_name === person.qa_assignee
                )
                const monthlyTickets = monthlyData?.tickets ?? []
                const seenM = new Set<string>()
                const uniqueM = monthlyTickets.filter((t: any) => {
                  if (seenM.has(t.ticket_key)) return false
                  seenM.add(t.ticket_key)
                  return true
                })
                return {
                  tickets: monthlyData?.unique_ticket_count || 0,
                  sp: monthlyData?.unique_ticket_story_points || 0,
                  firstPass: uniqueM.filter((t: any) => !t.had_previous_returns).length,
                  repeatPass: uniqueM.filter((t: any) => t.had_previous_returns).length,
                  avgCycleTime: 0,
                }
              })(),
              dailyRhythm: `Completed ${person.today_stats.ticket_count} tickets`,
              activities: person.today_tickets?.map((ticket: any) => ({
                ticketKey: ticket.ticket_id,
                sp: ticket.story_points || 0,
                type: ticket.pass_type === 'first_time_pass' ? 'First Pass' : 'Repeat Pass',
                time: ticket.completed_time_et,
                description: ticket.recap,
              })) || [],
            }
          }) || [],
          allMembers: output?.people?.map((p: any) => p.qa_assignee) || [],
          allStatuses: ['QA', 'In Progress', 'Done', 'Push Staging'],
          aiInsights: [],
          escapedBugs: [],
        }

        console.log('📊 Transformed data:', transformedData)
        setQaData(transformedData)

        // Transform data for TRIPS Testing section using rollback window data
        const w7Data = rollback_windows?.w7
        const w28Data = rollback_windows?.w28
        const priorW28Data = rollback_windows?.prior_w28
        
        // Use throughput data if available, otherwise use WIP data to show current workload
        const hasThroughput = w7Data?.throughput?.per_qa_member_throughput?.length > 0
        
        let testingTeamData = []
        
        if (hasThroughput) {
          // Use completed tickets data
          testingTeamData = w7Data.throughput.per_qa_member_throughput.map((member: any) => {
            const sp7 = member.unique_ticket_story_points || 0
            const tickets7 = member.unique_ticket_count || 0
            
            const member28 = w28Data?.throughput?.per_qa_member_throughput?.find(
              (m: any) => m.qa_name === member.qa_name
            )
            const sp28 = member28?.unique_ticket_story_points || 0
            const tickets28 = member28?.unique_ticket_count || 0
            
            const dailyPace = sp7 / 7
            
            return {
              name: member.qa_name,
              pace: { 7: sp7, 14: sp7 * 2, 30: sp28 || (sp7 * 4) },
              sp: { 7: sp7, 14: sp7 * 2, 30: sp28 || (sp7 * 4) },
              tickets: { 7: tickets7, 14: tickets7 * 2, 30: tickets28 || (tickets7 * 4) },
              avg60DailyPace: dailyPace,
            }
          })
        } else {
          // Use WIP data to show current workload when no recent completions
          testingTeamData = w7Data?.qa_in_progress?.per_qa_member_qa_in_progress?.map((member: any) => {
            const wipSP = member.qa_tickets_wip_story_points_total || 0
            const wipTickets = member.qa_tickets_wip_count || 0
            
            // Use prior 28-day throughput for historical context
            const memberPrior = priorW28Data?.throughput?.per_qa_member_throughput?.find(
              (m: any) => m.qa_name === member.qa_assignee
            )
            const priorSP = memberPrior?.unique_ticket_story_points || 0
            const priorTickets = memberPrior?.unique_ticket_count || 0
            
            return {
              name: member.qa_assignee,
              pace: { 7: wipSP, 14: wipSP, 30: priorSP || wipSP },
              sp: { 7: wipSP, 14: wipSP, 30: priorSP || wipSP },
              tickets: { 7: wipTickets, 14: wipTickets, 30: priorTickets || wipTickets },
              avg60DailyPace: priorSP / 28 || 0,
            }
          }) || []
        }

        setTestingData(testingTeamData)
        console.log('🧪 Testing team data:', testingTeamData, '(using', hasThroughput ? 'throughput' : 'WIP', 'data)')

      } catch (error) {
        console.error('Failed to fetch QA data:', error)
      } finally {
        setQaLoading(false)
      }
    }
    fetchQAData()
  }, [])

  useEffect(() => {
    async function fetchCRData() {
      try {
        const res = await fetch('/api/code-review-metrics/live')
        const d = await res.json()
        if (d.error) { setCrData(null); return }

        const { w7, prior_w7, w28, owners, prior_w7_owners, monthly_owners, exclusions, cycle_times, report_date, deltas } = d

        // Build lookups by owner name
        const priorOwnerMap = new Map<string, any>()
        for (const po of (prior_w7_owners ?? [])) priorOwnerMap.set(po.owner, po)

        const monthlyOwnerMap = new Map<string, any>()
        for (const mo of (monthly_owners ?? [])) monthlyOwnerMap.set(mo.owner, mo)

        // Collect all developer names (union of all windows)
        const allOwnerNames = Array.from(new Set([
          ...owners.map((o: any) => o.owner),
          ...(prior_w7_owners ?? []).map((o: any) => o.owner),
          ...(monthly_owners ?? []).map((o: any) => o.owner),
        ]))

        // Helper: compute calendar days from a timestamp to now
        const daysSince = (ts: string | undefined) => {
          if (!ts) return 0
          const days = (Date.now() - new Date(ts).getTime()) / (1000 * 60 * 60 * 24)
          return Math.max(0, parseFloat(days.toFixed(1)))
        }

        setCrData({
          metrics: {
            spThroughput: {
              last7: w7.weighted_story_points,
              last7Delta: deltas?.weighted_sp_change_pct ?? 0,
              last28: w28?.weighted_story_points ?? 0,
              last28Delta: 0,
              prior7: prior_w7.weighted_story_points,
              prior28: 0,
            },
            pace: {
              last7: w7.weighted_story_points,
              last28: w28?.weighted_story_points ?? 0,
            },
            assignedVolume: {
              totalTickets: w7.total_tickets,
              totalSP: w7.raw_story_points,
              agingOver7: exclusions.length,
            },
            qCycle: {
              last7: w7?.cr_cycle_avg_days ?? 0,
              last28: w28?.cr_cycle_avg_days ?? 0,
            },
            tCycle: {
              last7: w7?.t_cycle_avg_days ?? 0,
              last28: w28?.t_cycle_avg_days ?? 0,
            },
            rAgeCycle: {
              last7: cycle_times?.r_age_cycle_w7 ?? 0,
              last28: cycle_times?.r_age_cycle_w28 ?? 0,
            },
            escapedDefects: w7?.quality_issues ?? 0,
            critBugs: { open: exclusions.length, resolved: 0 },
          },
          criticalTickets: exclusions.map((ex: any) => {
            const last  = ex.pushback_history[ex.pushback_history.length - 1]
            const first = ex.pushback_history[0]
            const firstTs   = first?.cr_activity?.timestamp
            const latestTs  = last?.pushback_activity?.timestamp
            return {
              key: ex.key,
              recentAge: Math.round(daysSince(latestTs)),
              age: Math.round(daysSince(firstTs)),
              sp: null,
              assignee: last?.assignee ?? 'Unknown',
              developer: last?.assignee ?? 'Unknown',
              returnCount: ex.cr_pass_count - 1,
              firstQA: firstTs
                ? new Date(firstTs).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })
                : '',
              latestQA: latestTs
                ? new Date(latestTs).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })
                : '',
              status: last?.pushback_activity?.status ?? 'Unknown',
              summary: `Re-entered Code Review ${ex.cr_pass_count}x`,
            }
          }),
          agingTickets: [],
          dailyPerformance: {
            today: {
              date: `Last 7 Days (${report_date})`,
              tickets: w7.total_tickets,
              sp: w7.raw_story_points,
              firstPass: w7.pass_distribution.p1,
              firstPassSP: w7.first_pass_sp ?? 0,
              repeatPass: w7.total_tickets - w7.pass_distribution.p1,
              repeatPassSP: w7.repeat_pass_sp ?? 0,
            },
            previous: {
              date: 'Prior 7 Days',
              tickets: prior_w7.total_tickets,
              sp: prior_w7.raw_story_points,
              firstPass: prior_w7.pass_distribution.p1,
              firstPassSP: prior_w7.first_pass_sp ?? 0,
              repeatPass: prior_w7.total_tickets - prior_w7.pass_distribution.p1,
              repeatPassSP: prior_w7.repeat_pass_sp ?? 0,
            },
            last30BD: {
              tickets: w28?.total_tickets ?? 0,
              sp: w28?.raw_story_points ?? 0,
              firstPass: w28?.pass_distribution?.p1 ?? 0,
              repeatPass: (w28?.total_tickets ?? 0) - (w28?.pass_distribution?.p1 ?? 0),
              repeatPassSP: w28?.repeat_pass_sp ?? 0,
            },
          },
          teamMembers: allOwnerNames.map((name: string) => {
            const o  = owners.find((x: any) => x.owner === name)
            const po = priorOwnerMap.get(name)
            const mo = monthlyOwnerMap.get(name)
            const churn = o
              ? (o.ticket_count > 0 ? Math.round((o.repeat_pass_count / o.ticket_count) * 100) : 0)
              : 0
            const priorChurn = po
              ? (po.ticket_count > 0 ? Math.round((po.repeat_pass_count / po.ticket_count) * 100) : 0)
              : 0
            return {
              name,
              // "today" = this week's w7 data (CR has no per-day breakdown)
              today: {
                tickets: o?.ticket_count ?? 0,
                sp: o?.weighted_sp ?? 0,
                firstPass: o?.first_pass_count ?? 0,
                firstPassSP: o?.first_pass_sp ?? 0,
                repeatPass: o?.repeat_pass_count ?? 0,
                repeatPassSP: o?.repeat_pass_sp ?? 0,
                churn,
              },
              previousDay: {
                tickets: po?.ticket_count ?? 0,
                sp: po?.weighted_sp ?? 0,
                firstPass: po?.first_pass_count ?? 0,
                firstPassSP: po?.first_pass_sp ?? 0,
                repeatPass: po?.repeat_pass_count ?? 0,
                repeatPassSP: po?.repeat_pass_sp ?? 0,
                churn: priorChurn,
              },
              weekly: {
                tickets: o?.ticket_count ?? 0,
                sp: o?.weighted_sp ?? 0,
                firstPass: o?.first_pass_count ?? 0,
                repeatPass: o?.repeat_pass_count ?? 0,
                avgCycleTime: cycle_times?.r_age_cycle_w7 ?? 0,
              },
              monthly: {
                tickets: mo?.ticket_count ?? 0,
                sp: mo?.weighted_sp ?? 0,
                firstPass: mo?.first_pass_count ?? 0,
                repeatPass: mo?.repeat_pass_count ?? 0,
                avgCycleTime: cycle_times?.r_age_cycle_w28 ?? 0,
              },
              dailyRhythm: o
                ? `${o.ticket_count} ticket${o.ticket_count !== 1 ? 's' : ''} in Code Review this week · ${o.first_pass_count} first-pass, ${o.repeat_pass_count} repeat-pass`
                : 'No tickets in Code Review this week',
              activities: (o?.tickets ?? []).map((t: any) => ({
                ticketKey: t.key,
                sp: t.story_points ?? 0,
                type: t.tracked_pass_count === 1 ? 'First Pass' : `Repeat Pass #${t.tracked_pass_count - 1}`,
                time: '',
                description: `${t.key} reviewed in Code Review (${t.story_points ?? 0} pts, ${t.tracked_pass_count === 1 ? 'first-time pass' : `repeat pass #${t.tracked_pass_count - 1}`})`,
              })),
            }
          }),
          allMembers: allOwnerNames,
          allStatuses: ['Code Review', 'In Progress', 'Ready for Dev'],
          aiInsights: [],
        })
      } catch {
        setCrData(null)
      } finally {
        setCrLoading(false)
      }
    }
    fetchCRData()
  }, [])

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-4 lg:px-8">
        <div className="mx-auto max-w-[1400px] flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="size-4" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">PACE Dashboard</h1>
            <p className="text-xs text-muted-foreground">TRIPS Performance Tracking - Testing, Review, Infrastructure, PRD, Support</p>
          </div>
          <span className="ml-auto rounded bg-muted px-2.5 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            February 23, 2026
          </span>
        </div>
      </header>

      {/* Dashboard Content */}
      <div className="mx-auto max-w-[1400px] px-4 py-6 lg:px-8">
        <Tabs defaultValue="trips" className="gap-4">
          <TabsList className="h-10">
            <TabsTrigger value="trips" className="gap-1.5 px-4">
              <Layers className="size-3.5" />
              <span>TRIPS Summary</span>
            </TabsTrigger>
            <TabsTrigger value="qa" className="gap-1.5 px-4">
              <ShieldCheck className="size-3.5" />
              <span>T - Testing / QA</span>
            </TabsTrigger>
            <TabsTrigger value="documentation" className="gap-1.5 px-4">
              <FileText className="size-3.5" />
              <span>P - PRD / Docs</span>
            </TabsTrigger>
            <TabsTrigger value="code-review" className="gap-1.5 px-4">
              <GitPullRequest className="size-3.5" />
              <span>R - Code Review</span>
            </TabsTrigger>
            <TabsTrigger value="infrastructure" className="gap-1.5 px-4">
              <Server className="size-3.5" />
              <span>I - Infrastructure</span>
            </TabsTrigger>
            <TabsTrigger value="support" className="gap-1.5 px-4">
              <Headphones className="size-3.5" />
              <span>S - Support</span>
            </TabsTrigger>
            <TabsTrigger value="client-md" className="gap-1.5 px-4">
              <BookOpen className="size-3.5" />
              <span>Client.MD</span>
            </TabsTrigger>
            <TabsTrigger value="data-model" className="gap-1.5 px-4">
              <Database className="size-3.5" />
              <span>Data Model</span>
            </TabsTrigger>
          </TabsList>

          {/* TRIPS Summary Tab */}
          <TabsContent value="trips">
            <TripsSummary testingMembers={testingData} />
          </TabsContent>

          {/* QA PACE Tab */}
          <TabsContent value="qa">
            {qaLoading ? (
              <div className="flex items-center justify-center h-96">
                <p className="text-muted-foreground">Loading QA data...</p>
              </div>
            ) : qaData ? (
              <PaceDashboardTab
                label="QA"
                dashboardType="qa"
                metrics={qaData.metrics}
                criticalTickets={qaData.criticalTickets}
                agingTickets={qaData.agingTickets}
                dailyPerformance={qaData.dailyPerformance}
                teamMembers={qaData.teamMembers}
                allMembers={qaData.allMembers}
                allStatuses={qaData.allStatuses}
                paceLabel="QA PACE"
                volumeLabel="Assigned to QA Volume (Last 7 Days)"
                qCycleLabel="Q-Cycle (To Q.A)"
                rAgeLabel="R-Age Cycle Time (QA Pushback)"
                performanceTitle="Daily QA Performance"
                agingTableTitle="Aging in QA (Age > 3 BD)"
                aiInsights={qaData.aiInsights || []}
                escapedBugs={qaData.escapedBugs || []}
                showEscapedBugs={true}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-96 gap-4">
                <p className="text-muted-foreground">
                  {qaData?.error ? '⚠️ Jira Configuration Required' : 'No QA data available'}
                </p>
                <p className="text-sm text-muted-foreground max-w-md text-center">
                  {qaData?.message || 'Waiting for data from Jira'}
                </p>
                {qaData?.instructions && (
                  <div className="bg-muted p-4 rounded-md max-w-md">
                    <p className="text-xs text-muted-foreground mb-2">To fix this:</p>
                    <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
                      <li>Get your Jira API token from: <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" className="text-primary underline">Atlassian API Tokens</a></li>
                      <li>Add it to your <code className="bg-background px-1 rounded">.env.local</code> file</li>
                      <li>Restart your dev server</li>
                    </ol>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Documentation PACE Tab */}
          <TabsContent value="documentation">
            <PaceDashboardTab
              label="Documentation"
              dashboardType="documentation"
              metrics={docSnapshotMetrics}
              criticalTickets={docCriticalTickets}
              agingTickets={docAgingTickets}
              dailyPerformance={docDailyPerformance}
              teamMembers={docTeamMemberPerformance}
              allMembers={["Jordan Beebe", "Mike Del Signore", "Joey Stapleton", "charlson", "Corbin Schmeil"]}
              allStatuses={docAllStatuses}
              paceLabel="Documentation PACE"
              volumeLabel="Assigned to Documentation Volume (Last 7 Days)"
              qCycleLabel="D-Cycle (To Documentation)"
              tCycleLabel="T-Cycle Time (To Ready for Dev)"
              rAgeLabel="R-Age Cycle Time (Doc Pushback)"
              defectsLabel="[Beta] Doc Gaps Identified (Last 7 Days)"
              critBugsLabel="Critical Doc Issues (Last 7 Days)"
              performanceTitle="Daily Documentation Performance"
              critTableTitle="Critical Documentation Tickets"
              agingTableTitle="Aging in Documentation (Age > 3 BD)"
              aiInsights={docAIInsights}
            />
          </TabsContent>

          {/* Code Review PACE Tab */}
          <TabsContent value="code-review">
            {crLoading ? (
              <div className="flex items-center justify-center h-96">
                <p className="text-muted-foreground">Loading Code Review data...</p>
              </div>
            ) : crData ? (
              <PaceDashboardTab
                label="Code Review"
                dashboardType="code-review"
                metrics={crData.metrics}
                criticalTickets={crData.criticalTickets}
                agingTickets={crData.agingTickets}
                dailyPerformance={crData.dailyPerformance}
                teamMembers={crData.teamMembers}
                allMembers={crData.allMembers}
                allStatuses={crData.allStatuses}
                paceLabel="Code Review PACE"
                volumeLabel="Assigned to Code Review Volume (Last 7 Days)"
                qCycleLabel="CR-Cycle (To Code Review)"
                tCycleLabel="T-Cycle Time (To Ready for Dev)"
                rAgeLabel="R-Age Cycle Time (CR Pushback)"
                defectsLabel="[Beta] Code Quality Issues (Last 7 Days)"
                critBugsLabel="Critical CR Blockers (Last 7 Days)"
                performanceTitle="Daily Code Review Performance"
                critTableTitle="Re-entered Tickets (28 Days)"
                agingTableTitle="Aging in Code Review (Age > 3 BD)"
                aiInsights={crData.aiInsights}
              />
            ) : (
              <div className="flex items-center justify-center h-96">
                <p className="text-muted-foreground">No Code Review data available</p>
              </div>
            )}
          </TabsContent>

          {/* Infrastructure Tab */}
          <TabsContent value="infrastructure">
            <InfrastructureDashboard />
          </TabsContent>

          {/* Support Tab */}
          <TabsContent value="support">
            <SupportDashboard />
          </TabsContent>

          {/* Client.MD Tab */}
          <TabsContent value="client-md">
            <ClientKnowledgeDashboard />
          </TabsContent>

          {/* Data Model Tab */}
          <TabsContent value="data-model">
            <DataModel />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
