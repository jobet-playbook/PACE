import { NextResponse } from 'next/server'
import { getQAMetricsCache } from '@/lib/qa-cache'

// This endpoint transforms the cached QA metrics into the dashboard format
export async function GET() {
  try {
    const cachedData = getQAMetricsCache()
    
    // Check if we have cached data
    if (!cachedData) {
      // Return empty/default data if no cache available
      return NextResponse.json({
        metrics: {
          spThroughput: { last7: 0, last7Delta: 0, last28: 0, last28Delta: 0, prior7: 0, prior28: 0 },
          pace: { last7: 0, last28: 0 },
          assignedVolume: { totalTickets: 0, totalSP: 0, agingOver7: 0 },
          qCycle: { last7: 0, last28: 0 },
          tCycle: { last7: 0, last28: 0 },
          rAgeCycle: { last7: 0, last28: 0 },
          escapedDefects: 0,
          critBugs: { open: 0, resolved: 0 },
        },
        criticalTickets: [],
        agingTickets: [],
        dailyPerformance: {
          today: { tickets: 0, sp: 0, firstPass: 0, repeatPass: 0 },
          yesterday: { tickets: 0, sp: 0, firstPass: 0, repeatPass: 0 },
        },
        teamMembers: [],
        allMembers: [],
        allStatuses: ['QA', 'In Progress', 'Done', 'Push Staging'],
        aiInsights: [],
        escapedBugs: [],
        message: 'No live data available yet. Waiting for n8n workflow.',
      })
    }

    // Extract data from cache
    const { output, critical_qa_wip_tickets, old_qa_wip_tickets } = cachedData

    // Transform to dashboard format
    const dashboardData = {
      metrics: {
        spThroughput: {
          last7: output.today_overview.total_story_points,
          last7Delta: 0,
          last28: 0,
          last28Delta: 0,
          prior7: output.last_business_day_overview.total_story_points,
          prior28: 0,
        },
        pace: {
          last7: output.today_overview.repeat_percentage,
          last28: 0,
        },
        assignedVolume: {
          totalTickets: (critical_qa_wip_tickets?.length || 0) + (old_qa_wip_tickets?.length || 0),
          totalSP: 0,
          agingOver7: old_qa_wip_tickets?.length || 0,
        },
        qCycle: {
          last7: 0,
          last28: 0,
        },
        tCycle: {
          last7: 0,
          last28: 0,
        },
        rAgeCycle: {
          last7: 0,
          last28: 0,
        },
        escapedDefects: 0,
        critBugs: {
          open: critical_qa_wip_tickets?.length || 0,
          resolved: 0,
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
          tickets: output.today_overview.total_tickets,
          sp: output.today_overview.total_story_points,
          firstPass: output.today_overview.first_time.ticket_count,
          repeatPass: output.today_overview.repeat_pass.ticket_count,
        },
        yesterday: {
          tickets: output.last_business_day_overview.total_tickets,
          sp: output.last_business_day_overview.total_story_points,
          firstPass: output.last_business_day_overview.first_time.ticket_count,
          repeatPass: output.last_business_day_overview.repeat_pass.ticket_count,
        },
      },
      teamMembers: output.people?.map((person: any) => ({
        name: person.personName,
        todayTickets: person.today_stats.ticket_count,
        todaySP: person.today_stats.story_points,
        todayFirstPass: person.today_stats.first_time_count,
        todayFirstPassSP: 0,
        todayRepeatPass: person.today_stats.repeat_count,
        todayRepeatPassSP: 0,
        todayChurn: person.today_stats.repeat_percentage,
        weeklyTickets: 0,
        weeklySP: 0,
        weeklyFirstPass: 0,
        weeklyRepeatPass: 0,
        weeklyAvgCycleTime: 0,
        monthlyTickets: 0,
        monthlySP: 0,
        monthlyFirstPass: 0,
        monthlyRepeatPass: 0,
        monthlyAvgCycleTime: 0,
        dailyRhythm: person.activitySummary.summaryText,
        activities: person.today_tickets?.map((ticket: any) => ({
          ticketKey: ticket.ticket_id,
          sp: ticket.story_points || 0,
          type: ticket.pass_type === 'first_time_pass' ? 'First Pass' : 'Repeat Pass',
          time: ticket.completed_time_et,
          description: ticket.recap,
        })) || [],
      })) || [],
      allMembers: output.people?.map((p: any) => p.personName) || [],
      allStatuses: ['QA', 'In Progress', 'Done', 'Push Staging'],
      aiInsights: [],
      escapedBugs: [],
      reportMeta: output.report_meta,
      reportDate: output.date,
    }

    return NextResponse.json(dashboardData)
  } catch (error) {
    console.error('Error transforming QA metrics:', error)
    return NextResponse.json(
      { 
        error: 'Failed to retrieve live QA data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
