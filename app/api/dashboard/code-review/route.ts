import { NextResponse } from 'next/server'
import {
  crSnapshotMetrics,
  crCriticalTickets,
  crAgingTickets,
  crDailyPerformance,
  crTeamMemberPerformance,
  crAllStatuses,
  crAIInsights,
} from '@/lib/dashboard-data'

export async function GET() {
  try {
    return NextResponse.json({
      metrics: crSnapshotMetrics,
      criticalTickets: crCriticalTickets,
      agingTickets: crAgingTickets,
      dailyPerformance: crDailyPerformance,
      teamMembers: crTeamMemberPerformance,
      allMembers: ["Davi Chaves", "Joey Stapleton", "Mike Del Signore", "Jordan Beebe"],
      allStatuses: crAllStatuses,
      aiInsights: crAIInsights,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch code review dashboard data' },
      { status: 500 }
    )
  }
}
