import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// This endpoint transforms the QA metrics from Supabase into the dashboard format
export async function GET() {
  try {
    console.log('🔍 [QA Live] Fetching data from Supabase...')
    console.log('🔍 [QA Live] Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
    
    // Fetch the most recent record from Supabase
    const { data: dbData, error } = await supabase
      .from('pace_qa_metrics')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    console.log('🔍 [QA Live] Supabase response - Error:', error)
    console.log('🔍 [QA Live] Supabase response - Data:', dbData ? 'Data found' : 'No data')
    
    // Check if we have data
    if (error || !dbData) {
      console.log('⚠️ [QA Live] No data in database or error occurred')
      if (error) console.error('❌ [QA Live] Supabase error details:', error)
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
          today: { date: '', tickets: 0, sp: 0, firstPass: 0, firstPassSP: 0, repeatPass: 0, repeatPassSP: 0 },
          previous: { date: '', tickets: 0, sp: 0, firstPass: 0, firstPassSP: 0, repeatPass: 0, repeatPassSP: 0 },
          last30BD: { tickets: 0, sp: 0, firstPass: 0, repeatPass: 0, repeatPassSP: 0 },
        },
        teamMembers: [],
        allMembers: [],
        allStatuses: ['QA', 'In Progress', 'Done', 'Push Staging'],
        aiInsights: [],
        escapedBugs: [],
        message: 'No live data available yet. Waiting for n8n workflow.',
      })
    }

    // Extract data from database
    const { output, critical_wip_tickets, old_qa_wip_tickets } = dbData

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
          totalTickets: (critical_wip_tickets?.length || 0) + (old_qa_wip_tickets?.length || 0),
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
          open: critical_wip_tickets?.length || 0,
          resolved: 0,
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
          date: output.report_meta.today_label,
          tickets: output.today_overview.total_tickets,
          sp: output.today_overview.total_story_points,
          firstPass: output.today_overview.first_time.ticket_count,
          firstPassSP: output.today_overview.first_time.story_points,
          repeatPass: output.today_overview.repeat_pass.ticket_count,
          repeatPassSP: output.today_overview.repeat_pass.story_points,
        },
        previous: {
          date: output.report_meta.last_business_day_label,
          tickets: output.last_business_day_overview.total_tickets,
          sp: output.last_business_day_overview.total_story_points,
          firstPass: output.last_business_day_overview.first_time.ticket_count,
          firstPassSP: output.last_business_day_overview.first_time.story_points,
          repeatPass: output.last_business_day_overview.repeat_pass.ticket_count,
          repeatPassSP: output.last_business_day_overview.repeat_pass.story_points,
        },
        last30BD: {
          tickets: 0,
          sp: 0,
          firstPass: 0,
          repeatPass: 0,
          repeatPassSP: 0,
        },
      },
      teamMembers: output.people?.map((person: any) => ({
        name: person.personName,
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
          tickets: 0,
          sp: 0,
          firstPass: 0,
          firstPassSP: 0,
          repeatPass: 0,
          repeatPassSP: 0,
          churn: 0,
        },
        weekly: {
          tickets: 0,
          sp: 0,
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
