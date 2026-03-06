import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role for writes

const supabase = createClient(supabaseUrl, supabaseKey)

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function parseDate(dateStr: string): string {
  // Convert MM/DD/YY to YYYY-MM-DD
  const [month, day, year] = dateStr.split('/')
  const fullYear = `20${year}`
  return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function parseTime(timeStr: string): string | null {
  // Convert "4:20 PM ET" to "16:20:00"
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!match) return null
  
  let [_, hours, minutes, period] = match
  let hoursNum = parseInt(hours)
  
  if (period.toUpperCase() === 'PM' && hoursNum !== 12) {
    hoursNum += 12
  } else if (period.toUpperCase() === 'AM' && hoursNum === 12) {
    hoursNum = 0
  }
  
  return `${hoursNum.toString().padStart(2, '0')}:${minutes}:00`
}

function parseDateTime(dateStr: string, timeStr: string): string {
  const date = parseDate(dateStr)
  const time = parseTime(timeStr)
  return `${date}T${time || '00:00:00'}`
}

// ============================================================
// MAIN INGESTION HANDLER
// ============================================================

export async function POST(request: NextRequest) {
  try {
    console.log('📥 [QA Metrics V2] POST request received at:', new Date().toISOString())
    
    const data = await request.json()
    console.log('📦 [QA Metrics V2] Received data keys:', Object.keys(data))

    // Validate required fields
    if (!data.output?.report_meta || !data.output?.people) {
      return NextResponse.json(
        { error: 'Missing required fields: output.report_meta or output.people' },
        { status: 400 }
      )
    }

    const { output, rollback_windows, last_30_business_days, critical_qa_wip_tickets, old_qa_wip_tickets } = data

    // ============================================================
    // STEP 1: Create Daily Report
    // ============================================================
    const reportDate = parseDate(output.report_meta.today_label)
    
    console.log('📅 [QA Metrics V2] Creating report for date:', reportDate)

    const { data: existingReport } = await supabase
      .from('pace_qa_daily_reports')
      .select('id')
      .eq('report_date', reportDate)
      .single()

    let reportId: string

    if (existingReport) {
      console.log('ℹ️ [QA Metrics V2] Report already exists, updating...')
      reportId = existingReport.id
      
      await supabase
        .from('pace_qa_daily_reports')
        .update({
          generated_at: output.report_meta.generated_at_et,
          report_type: output.report_meta.report_type,
          status: data.status || 'GREEN',
          docs_id: data.docs_id
        })
        .eq('id', reportId)
    } else {
      const { data: newReport, error } = await supabase
        .from('pace_qa_daily_reports')
        .insert({
          report_date: reportDate,
          generated_at: output.report_meta.generated_at_et,
          report_type: output.report_meta.report_type,
          status: data.status || 'GREEN',
          docs_id: data.docs_id
        })
        .select('id')
        .single()

      if (error) throw error
      reportId = newReport.id
      console.log('✅ [QA Metrics V2] Created report:', reportId)
    }

    // ============================================================
    // STEP 2: Ensure Team Members Exist
    // ============================================================
    const memberIds = new Map<string, string>()

    for (const person of output.people) {
      const name = person.qa_assignee

      const { data: existing } = await supabase
        .from('pace_qa_team_members')
        .select('id')
        .eq('name', name)
        .single()

      if (existing) {
        memberIds.set(name, existing.id)
      } else {
        const { data: newMember, error } = await supabase
          .from('pace_qa_team_members')
          .insert({ name, role: 'QA Engineer' })
          .select('id')
          .single()

        if (error) throw error
        memberIds.set(name, newMember.id)
        console.log(`✅ [QA Metrics V2] Created team member: ${name}`)
      }
    }

    // ============================================================
    // STEP 3: Insert Daily Member Stats
    // ============================================================
    const dailyStats = output.people.map((person: any) => ({
      report_id: reportId,
      member_id: memberIds.get(person.qa_assignee),
      report_date: reportDate,
      tickets_completed: person.today_stats.ticket_count,
      story_points_completed: person.today_stats.story_points,
      first_time_pass_count: person.today_stats.first_time_count,
      repeat_pass_count: person.today_stats.repeat_count,
      repeat_percentage: person.today_stats.repeat_percentage
    }))

    // Delete existing stats for this report (in case of re-run)
    await supabase
      .from('pace_qa_daily_member_stats')
      .delete()
      .eq('report_id', reportId)

    const { error: statsError } = await supabase
      .from('pace_qa_daily_member_stats')
      .insert(dailyStats)

    if (statsError) throw statsError
    console.log(`✅ [QA Metrics V2] Inserted ${dailyStats.length} daily member stats`)

    // ============================================================
    // STEP 4: Insert Ticket Completions
    // ============================================================
    const ticketCompletions = []

    for (const person of output.people) {
      for (const ticket of person.today_tickets || []) {
        // Ensure ticket exists
        const ticketId = await ensureTicket(ticket.ticket_id, ticket.story_points)

        ticketCompletions.push({
          ticket_id: ticketId,
          member_id: memberIds.get(person.qa_assignee),
          report_id: reportId,
          completed_at: parseDateTime(output.report_meta.today_label, ticket.completed_time_et),
          completion_date: reportDate,
          completion_time: parseTime(ticket.completed_time_et),
          handled_stage: ticket.handled_stage,
          new_stage: ticket.new_stage,
          pass_type: ticket.pass_type,
          qa_return_cycles_count: ticket.qa_return_cycles_count,
          had_previous_returns: ticket.had_previous_returns,
          story_points: ticket.story_points,
          recap: ticket.recap
        })
      }
    }

    if (ticketCompletions.length > 0) {
      // Delete existing completions for this report
      await supabase
        .from('pace_qa_ticket_completions')
        .delete()
        .eq('report_id', reportId)

      const { error: completionsError } = await supabase
        .from('pace_qa_ticket_completions')
        .insert(ticketCompletions)

      if (completionsError) throw completionsError
      console.log(`✅ [QA Metrics V2] Inserted ${ticketCompletions.length} ticket completions`)
    }

    // ============================================================
    // STEP 5: Insert WIP Tickets
    // ============================================================
    const wipTickets = []
    const allWipTickets = [...(old_qa_wip_tickets || []), ...(critical_qa_wip_tickets || [])]
    const processedTickets = new Set<string>()

    for (const ticket of allWipTickets) {
      // Avoid duplicates
      if (processedTickets.has(ticket.ticket_key)) continue
      processedTickets.add(ticket.ticket_key)

      const ticketId = await ensureTicket(ticket.ticket_key, ticket.story_points, ticket.summary)
      const assigneeId = memberIds.get(ticket.assignee)

      if (!assigneeId) {
        console.warn(`⚠️ [QA Metrics V2] Assignee not found: ${ticket.assignee}`)
        continue
      }

      wipTickets.push({
        ticket_id: ticketId,
        assignee_id: assigneeId,
        developer_name: ticket.developer,
        initial_qa_date: ticket.initial_qa_date,
        latest_qa_date: ticket.latest_qa_date,
        qa_repetition_count: ticket.qa_repetition_count,
        qa_status: ticket.qa_status,
        age_business_days: ticket.age_bd,
        recent_age_business_days: ticket.recent_age_bd,
        is_critical: critical_qa_wip_tickets?.some((t: any) => t.ticket_key === ticket.ticket_key) || false,
        is_old: ticket.age_bd > 7,
        snapshot_date: reportDate,
        report_id: reportId
      })
    }

    if (wipTickets.length > 0) {
      // Delete existing WIP tickets for this snapshot date
      await supabase
        .from('pace_qa_wip_tickets')
        .delete()
        .eq('snapshot_date', reportDate)

      const { error: wipError } = await supabase
        .from('pace_qa_wip_tickets')
        .insert(wipTickets)

      if (wipError) throw wipError
      console.log(`✅ [QA Metrics V2] Inserted ${wipTickets.length} WIP tickets`)
    }

    // ============================================================
    // STEP 6: Insert Rollback Windows
    // ============================================================
    if (rollback_windows) {
      const windows = []

      for (const [windowType, data] of Object.entries(rollback_windows)) {
        const windowData = data as any

        windows.push({
          report_id: reportId,
          window_type: windowType,
          window_description: windowData.rollback_window_description,
          to_qa_avg_bd: windowData.cycle_time?.to_qa_avg_bd,
          to_done_avg_bd: windowData.cycle_time?.to_done_avg_bd,
          to_pushback_avg_bd: windowData.cycle_time?.to_pushback_avg_bd,
          total_story_points: windowData.throughput?.total_story_points,
          total_qa_phase_story_points: windowData.throughput?.total_qa_phase_story_points,
          total_tickets: windowData.throughput?.total_tickets,
          qa_in_progress_tickets: windowData.qa_in_progress?.total_tickets,
          qa_in_progress_story_points: windowData.qa_in_progress?.total_story_points,
          old_wip_tickets_count: windowData.qa_in_progress?.old_qa_wip_tickets?.length || 0,
          critical_wip_tickets_count: windowData.qa_in_progress?.critical_qa_wip_tickets?.length || 0,
          escaped_defects_count: windowData.defects?.escaped_defects_count || 0,
          critical_defects_total: windowData.defects?.critical_defects?.total_count || 0,
          critical_defects_unresolved: windowData.defects?.critical_defects?.unresolved_count || 0,
          critical_defects_resolved: windowData.defects?.critical_defects?.resolved_count || 0
        })
      }

      // Delete existing windows for this report
      await supabase
        .from('pace_qa_rollback_windows')
        .delete()
        .eq('report_id', reportId)

      const { error: windowsError } = await supabase
        .from('pace_qa_rollback_windows')
        .insert(windows)

      if (windowsError) throw windowsError
      console.log(`✅ [QA Metrics V2] Inserted ${windows.length} rollback windows`)
    }

    // ============================================================
    // STEP 7: Insert 30-Day Summary
    // ============================================================
    if (last_30_business_days) {
      // Delete existing summary for this report
      await supabase
        .from('pace_qa_30day_summary')
        .delete()
        .eq('report_id', reportId)

      const { data: summary, error: summaryError } = await supabase
        .from('pace_qa_30day_summary')
        .insert({
          report_id: reportId,
          total_tickets: last_30_business_days.total_tickets,
          first_qa_cycle_tickets: last_30_business_days.first_qa_cycle?.ticket_count,
          returning_qa_cycle_tickets: last_30_business_days.returning_qa_cycle?.ticket_count,
          total_story_points: last_30_business_days.story_points,
          first_qa_cycle_story_points: last_30_business_days.first_qa_cycle?.story_points,
          returning_qa_cycle_story_points: last_30_business_days.returning_qa_cycle?.story_points
        })
        .select('id')
        .single()

      if (summaryError) throw summaryError
      console.log('✅ [QA Metrics V2] Inserted 30-day summary')

      // Insert per-member throughput
      if (last_30_business_days.qa_handlers) {
        const throughputs = last_30_business_days.qa_handlers
          .map((handler: any) => ({
            summary_id: summary.id,
            member_id: memberIds.get(handler.qa_assignee),
            handled_ticket_count: handler.handled_ticket_count,
            handled_ticket_story_points: handler.handled_ticket_story_points
          }))
          .filter((t: any) => t.member_id)

        if (throughputs.length > 0) {
          const { error: throughputError } = await supabase
            .from('pace_qa_member_30day_throughput')
            .insert(throughputs)

          if (throughputError) throw throughputError
          console.log(`✅ [QA Metrics V2] Inserted ${throughputs.length} member 30-day throughputs`)
        }
      }
    }

    // ============================================================
    // STEP 8: Insert AI Insights
    // ============================================================
    if (data.thirty_second_take || data.whats_driving_today) {
      const insights = []

      if (data.thirty_second_take) {
        insights.push({
          report_id: reportId,
          insight_type: 'thirty_second_take',
          summary: data.thirty_second_take.summary,
          priority: 'high',
          points: data.thirty_second_take.points,
          actions: data.thirty_second_take.actions
        })
      }

      if (data.whats_driving_today) {
        insights.push({
          report_id: reportId,
          insight_type: 'whats_driving_today',
          summary: 'Daily drivers and blockers',
          priority: 'medium',
          points: data.whats_driving_today.sections,
          actions: []
        })
      }

      // Delete existing insights for this report
      await supabase
        .from('pace_qa_insights')
        .delete()
        .eq('report_id', reportId)

      const { error: insightsError } = await supabase
        .from('pace_qa_insights')
        .insert(insights)

      if (insightsError) throw insightsError
      console.log(`✅ [QA Metrics V2] Inserted ${insights.length} insights`)
    }

    // ============================================================
    // SUCCESS RESPONSE
    // ============================================================
    return NextResponse.json({
      success: true,
      message: 'QA metrics data ingested successfully',
      reportId,
      reportDate,
      stats: {
        teamMembers: memberIds.size,
        dailyStats: dailyStats.length,
        ticketCompletions: ticketCompletions.length,
        wipTickets: wipTickets.length,
        rollbackWindows: rollback_windows ? Object.keys(rollback_windows).length : 0
      }
    })

  } catch (error) {
    console.error('❌ [QA Metrics V2] Error processing QA metrics:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process QA metrics data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// ============================================================
// HELPER: Ensure Ticket Exists
// ============================================================
async function ensureTicket(ticketKey: string, storyPoints?: number, summary?: string): Promise<string> {
  const { data: existing } = await supabase
    .from('pace_qa_tickets')
    .select('id')
    .eq('ticket_key', ticketKey)
    .single()

  if (existing) {
    return existing.id
  }

  const { data: newTicket, error } = await supabase
    .from('pace_qa_tickets')
    .insert({
      ticket_key: ticketKey,
      story_points: storyPoints,
      summary
    })
    .select('id')
    .single()

  if (error) throw error
  return newTicket.id
}

// ============================================================
// GET: Retrieve Latest Report
// ============================================================
export async function GET(request: NextRequest) {
  try {
    const { data: latestReport, error } = await supabase
      .from('pace_qa_daily_reports')
      .select('*')
      .order('report_date', { ascending: false })
      .limit(1)
      .single()

    if (error || !latestReport) {
      return NextResponse.json(
        { error: 'No reports found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: latestReport
    })

  } catch (error) {
    console.error('❌ [QA Metrics V2] Error retrieving report:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve report' },
      { status: 500 }
    )
  }
}
