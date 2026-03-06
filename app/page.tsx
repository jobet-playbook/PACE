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

        // Transform the data for the dashboard
        const { output, critical_wip_tickets, old_qa_wip_tickets } = latestRecord

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
              last7: output?.today_overview?.repeat_percentage || 0,
              last28: 0,
            },
            assignedVolume: {
              totalTickets: rollback_windows?.w7?.qa_in_progress?.total_tickets || (critical_wip_tickets?.length || 0) + (old_qa_wip_tickets?.length || 0),
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
              open: rollback_windows?.w28?.defects?.critical_defects?.unresolved_count || critical_wip_tickets?.length || 0,
              resolved: rollback_windows?.w28?.defects?.critical_defects?.resolved_count || 0,
            },
          },
          criticalTickets: critical_wip_tickets?.map((ticket: any) => ({
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
              tickets: output?.today_overview?.total_tickets || 0,
              sp: output?.today_overview?.total_story_points || 0,
              firstPass: output?.today_overview?.first_time?.ticket_count || 0,
              firstPassSP: output?.today_overview?.first_time?.story_points || 0,
              repeatPass: output?.today_overview?.repeat_pass?.ticket_count || 0,
              repeatPassSP: output?.today_overview?.repeat_pass?.story_points || 0,
            },
            previous: {
              date: output?.report_meta?.last_business_day_label || '',
              tickets: output?.last_business_day_overview?.total_tickets || 0,
              sp: output?.last_business_day_overview?.total_story_points || 0,
              firstPass: output?.last_business_day_overview?.first_time?.ticket_count || 0,
              firstPassSP: output?.last_business_day_overview?.first_time?.story_points || 0,
              repeatPass: output?.last_business_day_overview?.repeat_pass?.ticket_count || 0,
              repeatPassSP: output?.last_business_day_overview?.repeat_pass?.story_points || 0,
            },
            last30BD: {
              tickets: 0,
              sp: 0,
              firstPass: 0,
              repeatPass: 0,
              repeatPassSP: 0,
            },
          },
          teamMembers: output?.people?.map((person: any) => ({
            name: person.qa_assignee,
            today: {
              tickets: person.today_stats.ticket_count,
              sp: person.today_stats.story_points,
              firstPass: person.today_stats.first_time_count,
              firstPassSP: 0,
              repeatPass: person.today_stats.repeat_count,
              repeatPassSP: 0,
              churn: person.today_stats.repeat_percentage,
            },
            previousDay: {
              tickets: person.last_business_day_stats?.ticket_count || 0,
              sp: person.last_business_day_stats?.story_points || 0,
              firstPass: person.last_business_day_stats?.first_time_count || 0,
              firstPassSP: 0,
              repeatPass: person.last_business_day_stats?.repeat_count || 0,
              repeatPassSP: 0,
              churn: person.last_business_day_stats?.repeat_percentage || 0,
            },
            weekly: {
              tickets: person.wip_count || 0,
              sp: person.wip_story_points || 0,
              firstPass: 0,
              repeatPass: 0,
              avgCycleTime: 0,
            },
            monthly: {
              tickets: 0,
              sp: 0,
              firstPass: 0,
              repeatPass: 0,
              avgCycleTime: 0,
            },
            dailyRhythm: `Completed ${person.today_stats.ticket_count} tickets`,
            activities: person.today_tickets?.map((ticket: any) => ({
              ticketKey: ticket.ticket_id,
              sp: ticket.story_points || 0,
              type: ticket.pass_type === 'first_time_pass' ? 'First Pass' : 'Repeat Pass',
              time: ticket.completed_time_et,
              description: ticket.recap,
            })) || [],
          })) || [],
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
        
        const testingTeamData = w7Data?.throughput?.per_qa_member_throughput?.map((member: any) => {
          // Get 7-day data
          const sp7 = member.unique_ticket_story_points || 0
          const tickets7 = member.unique_ticket_count || 0
          
          // Find 28-day data for the same member
          const member28 = w28Data?.throughput?.per_qa_member_throughput?.find(
            (m: any) => m.qa_name === member.qa_name
          )
          const sp28 = member28?.unique_ticket_story_points || 0
          const tickets28 = member28?.unique_ticket_count || 0
          
          // Calculate daily pace from 7-day window
          const dailyPace = sp7 / 7
          
          return {
            name: member.qa_name,
            pace: {
              7: sp7,
              14: sp7 * 2, // Estimate
              30: sp28 || (sp7 * 4), // Use 28-day data or estimate
            },
            sp: {
              7: sp7,
              14: sp7 * 2,
              30: sp28 || (sp7 * 4),
            },
            tickets: {
              7: tickets7,
              14: tickets7 * 2,
              30: tickets28 || (tickets7 * 4),
            },
            avg60DailyPace: dailyPace,
          }
        }) || []

        setTestingData(testingTeamData)
        console.log('🧪 Testing team data:', testingTeamData)

      } catch (error) {
        console.error('Failed to fetch QA data:', error)
      } finally {
        setQaLoading(false)
      }
    }
    fetchQAData()
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
            <PaceDashboardTab
              label="Code Review"
              dashboardType="code-review"
              metrics={crSnapshotMetrics}
              criticalTickets={crCriticalTickets}
              agingTickets={crAgingTickets}
              dailyPerformance={crDailyPerformance}
              teamMembers={crTeamMemberPerformance}
              allMembers={["Davi Chaves", "Joey Stapleton", "Mike Del Signore", "Jordan Beebe"]}
              allStatuses={crAllStatuses}
              paceLabel="Code Review PACE"
              volumeLabel="Assigned to Code Review Volume (Last 7 Days)"
              qCycleLabel="CR-Cycle (To Code Review)"
              tCycleLabel="T-Cycle Time (To Ready for Dev)"
              rAgeLabel="R-Age Cycle Time (CR Pushback)"
              defectsLabel="[Beta] Code Quality Issues (Last 7 Days)"
              critBugsLabel="Critical CR Blockers (Last 7 Days)"
              performanceTitle="Daily Code Review Performance"
              critTableTitle="Critical Code Review Tickets"
              agingTableTitle="Aging in Code Review (Age > 3 BD)"
              aiInsights={crAIInsights}
            />
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
