/**
 * Data Migration Script
 * Transforms data from pace_qa_metrics (single table) to normalized schema
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

interface OldSchemaRecord {
  id: number
  created_at: string
  output: any
  last_30_business_days: any
  rollback_windows: any
  critical_wip_tickets: any[]
  old_qa_wip_tickets: any[]
  docs_id: string
}

async function migrateData() {
  console.log('🚀 Starting data migration...')

  try {
    // Step 1: Fetch all records from old schema
    console.log('📥 Fetching data from pace_qa_metrics...')
    const { data: oldRecords, error: fetchError } = await supabase
      .from('pace_qa_metrics')
      .select('*')
      .order('created_at', { ascending: true })

    if (fetchError) {
      throw new Error(`Failed to fetch old records: ${fetchError.message}`)
    }

    console.log(`✅ Found ${oldRecords?.length || 0} records to migrate`)

    if (!oldRecords || oldRecords.length === 0) {
      console.log('⚠️ No records to migrate')
      return
    }

    // Step 2: Migrate each record
    for (const record of oldRecords as OldSchemaRecord[]) {
      console.log(`\n📝 Migrating record from ${record.output.date}...`)
      await migrateRecord(record)
    }

    console.log('\n✅ Migration completed successfully!')
    console.log('\n📊 Summary:')
    await printMigrationSummary()

  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  }
}

async function migrateRecord(record: OldSchemaRecord) {
  const { output, last_30_business_days, rollback_windows, critical_wip_tickets, old_qa_wip_tickets, docs_id } = record

  // Step 1: Ensure team members exist
  const memberIds = await ensureTeamMembers(output.people)

  // Step 2: Create daily report
  const reportId = await createDailyReport(output, docs_id)

  // Step 3: Insert daily member stats
  await insertDailyMemberStats(reportId, output.people, memberIds, output.date)

  // Step 4: Insert ticket completions
  await insertTicketCompletions(reportId, output.people, memberIds, output.date)

  // Step 5: Insert WIP tickets
  await insertWIPTickets(reportId, [...critical_wip_tickets, ...old_qa_wip_tickets], memberIds, output.date)

  // Step 6: Insert rollback windows
  await insertRollbackWindows(reportId, rollback_windows)

  // Step 7: Insert 30-day summary
  await insert30DaySummary(reportId, last_30_business_days)

  // Step 8: Insert insights
  await insertInsights(reportId, output.thirty_second_take, output.whats_driving_today)

  console.log(`✅ Migrated record for ${output.date}`)
}

async function ensureTeamMembers(people: any[]): Promise<Map<string, string>> {
  const memberIds = new Map<string, string>()

  for (const person of people) {
    const name = person.personName || person.qa_assignee

    // Check if member exists
    const { data: existing } = await supabase
      .from('qa_team_members')
      .select('id')
      .eq('name', name)
      .single()

    if (existing) {
      memberIds.set(name, existing.id)
    } else {
      // Insert new member
      const { data: newMember, error } = await supabase
        .from('qa_team_members')
        .insert({ name, role: 'QA Engineer' })
        .select('id')
        .single()

      if (error) {
        console.error(`Failed to insert member ${name}:`, error)
        throw error
      }

      memberIds.set(name, newMember.id)
      console.log(`  ✅ Created team member: ${name}`)
    }
  }

  return memberIds
}

async function createDailyReport(output: any, docs_id: string): Promise<string> {
  const reportDate = parseDate(output.date)

  // Check if report already exists
  const { data: existing } = await supabase
    .from('qa_daily_reports')
    .select('id')
    .eq('report_date', reportDate)
    .single()

  if (existing) {
    console.log(`  ℹ️ Report for ${reportDate} already exists, skipping...`)
    return existing.id
  }

  const { data, error } = await supabase
    .from('qa_daily_reports')
    .insert({
      report_date: reportDate,
      generated_at: output.report_meta.generated_at_et,
      report_type: output.report_meta.report_type,
      status: output.status || 'GREEN',
      docs_id
    })
    .select('id')
    .single()

  if (error) {
    console.error('Failed to create daily report:', error)
    throw error
  }

  console.log(`  ✅ Created daily report: ${reportDate}`)
  return data.id
}

async function insertDailyMemberStats(
  reportId: string,
  people: any[],
  memberIds: Map<string, string>,
  reportDate: string
) {
  const stats = people.map(person => ({
    report_id: reportId,
    member_id: memberIds.get(person.personName),
    report_date: parseDate(reportDate),
    tickets_completed: person.today_stats.ticket_count,
    story_points_completed: person.today_stats.story_points,
    first_time_pass_count: person.today_stats.first_time_count,
    repeat_pass_count: person.today_stats.repeat_count,
    repeat_percentage: person.today_stats.repeat_percentage,
    total_actions: person.activitySummary?.totalActions || 0,
    first_action_time: person.activitySummary?.firstActionTime,
    last_action_time: person.activitySummary?.lastActionTime,
    total_inactive_minutes: person.timeAnalysis?.totalInactiveMinutes || 0
  }))

  const { error } = await supabase
    .from('qa_daily_member_stats')
    .insert(stats)

  if (error) {
    console.error('Failed to insert daily member stats:', error)
    throw error
  }

  console.log(`  ✅ Inserted ${stats.length} daily member stats`)
}

async function insertTicketCompletions(
  reportId: string,
  people: any[],
  memberIds: Map<string, string>,
  reportDate: string
) {
  const completions = []

  for (const person of people) {
    for (const ticket of person.today_tickets || []) {
      // Ensure ticket exists
      const ticketId = await ensureTicket(ticket.ticket_id, ticket.story_points)

      completions.push({
        ticket_id: ticketId,
        member_id: memberIds.get(person.personName),
        report_id: reportId,
        completed_at: parseDateTime(reportDate, ticket.completed_time_et),
        completion_date: parseDate(reportDate),
        completion_time: ticket.completed_time_et,
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

  if (completions.length > 0) {
    const { error } = await supabase
      .from('qa_ticket_completions')
      .insert(completions)

    if (error) {
      console.error('Failed to insert ticket completions:', error)
      throw error
    }

    console.log(`  ✅ Inserted ${completions.length} ticket completions`)
  }
}

async function ensureTicket(ticketKey: string, storyPoints?: number): Promise<string> {
  // Check if ticket exists
  const { data: existing } = await supabase
    .from('qa_tickets')
    .select('id')
    .eq('ticket_key', ticketKey)
    .single()

  if (existing) {
    return existing.id
  }

  // Insert new ticket
  const { data: newTicket, error } = await supabase
    .from('qa_tickets')
    .insert({
      ticket_key: ticketKey,
      story_points: storyPoints
    })
    .select('id')
    .single()

  if (error) {
    console.error(`Failed to insert ticket ${ticketKey}:`, error)
    throw error
  }

  return newTicket.id
}

async function insertWIPTickets(
  reportId: string,
  wipTickets: any[],
  memberIds: Map<string, string>,
  snapshotDate: string
) {
  const wips = []

  for (const ticket of wipTickets) {
    const ticketId = await ensureTicket(ticket.ticket_key, ticket.story_points)
    const assigneeId = memberIds.get(ticket.assignee)

    if (!assigneeId) {
      console.warn(`  ⚠️ Assignee not found for ticket ${ticket.ticket_key}: ${ticket.assignee}`)
      continue
    }

    wips.push({
      ticket_id: ticketId,
      assignee_id: assigneeId,
      developer_name: ticket.developer,
      initial_qa_date: ticket.initial_qa_date,
      latest_qa_date: ticket.latest_qa_date,
      qa_repetition_count: ticket.qa_repetition_count,
      qa_status: ticket.qa_status,
      age_business_days: ticket.age_bd,
      recent_age_business_days: ticket.recent_age_bd,
      is_critical: ticket.priority === 'Critical',
      is_old: ticket.age_bd > 7,
      snapshot_date: parseDate(snapshotDate),
      report_id: reportId
    })
  }

  if (wips.length > 0) {
    const { error } = await supabase
      .from('qa_wip_tickets')
      .insert(wips)

    if (error) {
      console.error('Failed to insert WIP tickets:', error)
      throw error
    }

    console.log(`  ✅ Inserted ${wips.length} WIP tickets`)
  }
}

async function insertRollbackWindows(reportId: string, rollbackWindows: any) {
  if (!rollbackWindows) return

  const windows = []

  for (const [windowType, data] of Object.entries(rollbackWindows)) {
    windows.push({
      report_id: reportId,
      window_type: windowType,
      window_description: (data as any).rollback_window_description,
      to_qa_avg_bd: (data as any).cycle_time?.to_qa_avg_bd,
      to_done_avg_bd: (data as any).cycle_time?.to_done_avg_bd,
      to_pushback_avg_bd: (data as any).cycle_time?.to_pushback_avg_bd,
      total_story_points: (data as any).throughput?.total_story_points,
      total_qa_phase_story_points: (data as any).throughput?.total_qa_phase_story_points,
      total_tickets: (data as any).throughput?.total_tickets,
      qa_in_progress_tickets: (data as any).qa_in_progress?.total_tickets,
      qa_in_progress_story_points: (data as any).qa_in_progress?.total_story_points,
      old_wip_tickets_count: (data as any).qa_in_progress?.old_qa_wip_tickets?.length || 0,
      critical_wip_tickets_count: (data as any).qa_in_progress?.critical_qa_wip_tickets?.length || 0,
      escaped_defects_count: (data as any).defects?.escaped_defects_count || 0,
      critical_defects_total: (data as any).defects?.critical_defects?.total_count || 0,
      critical_defects_unresolved: (data as any).defects?.critical_defects?.unresolved_count || 0,
      critical_defects_resolved: (data as any).defects?.critical_defects?.resolved_count || 0
    })
  }

  if (windows.length > 0) {
    const { error } = await supabase
      .from('qa_rollback_windows')
      .insert(windows)

    if (error) {
      console.error('Failed to insert rollback windows:', error)
      throw error
    }

    console.log(`  ✅ Inserted ${windows.length} rollback windows`)
  }
}

async function insert30DaySummary(reportId: string, last30Days: any) {
  if (!last30Days) return

  const { data, error } = await supabase
    .from('qa_30day_summary')
    .insert({
      report_id: reportId,
      total_tickets: last30Days.total_tickets,
      first_qa_cycle_tickets: last30Days.first_qa_cycle?.ticket_count,
      returning_qa_cycle_tickets: last30Days.returning_qa_cycle?.ticket_count,
      total_story_points: last30Days.story_points,
      first_qa_cycle_story_points: last30Days.first_qa_cycle?.story_points,
      returning_qa_cycle_story_points: last30Days.returning_qa_cycle?.story_points
    })
    .select('id')
    .single()

  if (error) {
    console.error('Failed to insert 30-day summary:', error)
    throw error
  }

  console.log(`  ✅ Inserted 30-day summary`)

  // Insert per-member throughput
  if (last30Days.qa_handlers) {
    const memberIds = new Map<string, string>()
    
    for (const handler of last30Days.qa_handlers) {
      const { data: member } = await supabase
        .from('qa_team_members')
        .select('id')
        .eq('name', handler.qa_assignee)
        .single()

      if (member) {
        memberIds.set(handler.qa_assignee, member.id)
      }
    }

    const throughputs = last30Days.qa_handlers.map((handler: any) => ({
      summary_id: data.id,
      member_id: memberIds.get(handler.qa_assignee),
      handled_ticket_count: handler.handled_ticket_count,
      handled_ticket_story_points: handler.handled_ticket_story_points
    })).filter((t: any) => t.member_id)

    if (throughputs.length > 0) {
      await supabase
        .from('qa_member_30day_throughput')
        .insert(throughputs)

      console.log(`  ✅ Inserted ${throughputs.length} member 30-day throughputs`)
    }
  }
}

async function insertInsights(reportId: string, thirtySecondTake: any, whatsDrivingToday: any) {
  const insights = []

  if (thirtySecondTake) {
    insights.push({
      report_id: reportId,
      insight_type: 'thirty_second_take',
      summary: thirtySecondTake.summary,
      priority: 'high',
      points: thirtySecondTake.points,
      actions: thirtySecondTake.actions
    })
  }

  if (whatsDrivingToday) {
    insights.push({
      report_id: reportId,
      insight_type: 'whats_driving_today',
      summary: 'Daily drivers and blockers',
      priority: 'medium',
      points: whatsDrivingToday.sections,
      actions: []
    })
  }

  if (insights.length > 0) {
    const { error } = await supabase
      .from('qa_insights')
      .insert(insights)

    if (error) {
      console.error('Failed to insert insights:', error)
      throw error
    }

    console.log(`  ✅ Inserted ${insights.length} insights`)
  }
}

// Helper functions
function parseDate(dateStr: string): string {
  // Convert MM/DD/YY to YYYY-MM-DD
  const [month, day, year] = dateStr.split('/')
  const fullYear = `20${year}`
  return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function parseDateTime(dateStr: string, timeStr: string): string {
  const date = parseDate(dateStr)
  // Convert time to 24-hour format if needed
  return `${date}T${timeStr}`
}

async function printMigrationSummary() {
  const { count: reportsCount } = await supabase
    .from('qa_daily_reports')
    .select('*', { count: 'exact', head: true })

  const { count: membersCount } = await supabase
    .from('qa_team_members')
    .select('*', { count: 'exact', head: true })

  const { count: statsCount } = await supabase
    .from('qa_daily_member_stats')
    .select('*', { count: 'exact', head: true })

  const { count: completionsCount } = await supabase
    .from('qa_ticket_completions')
    .select('*', { count: 'exact', head: true })

  const { count: wipsCount } = await supabase
    .from('qa_wip_tickets')
    .select('*', { count: 'exact', head: true })

  console.log(`  📊 Daily Reports: ${reportsCount}`)
  console.log(`  👥 Team Members: ${membersCount}`)
  console.log(`  📈 Daily Stats: ${statsCount}`)
  console.log(`  🎫 Ticket Completions: ${completionsCount}`)
  console.log(`  🔄 WIP Tickets: ${wipsCount}`)
}

// Run migration
migrateData().catch(console.error)
