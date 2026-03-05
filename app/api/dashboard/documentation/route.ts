import { NextResponse } from 'next/server'
import {
  docSnapshotMetrics,
  docCriticalTickets,
  docAgingTickets,
  docDailyPerformance,
  docTeamMemberPerformance,
  docAllStatuses,
  docAIInsights,
} from '@/lib/dashboard-data'

export async function GET() {
  try {
    return NextResponse.json({
      metrics: docSnapshotMetrics,
      criticalTickets: docCriticalTickets,
      agingTickets: docAgingTickets,
      dailyPerformance: docDailyPerformance,
      teamMembers: docTeamMemberPerformance,
      allMembers: ["Jordan Beebe", "Mike Del Signore", "Joey Stapleton", "charlson", "Corbin Schmeil"],
      allStatuses: docAllStatuses,
      aiInsights: docAIInsights,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch documentation dashboard data' },
      { status: 500 }
    )
  }
}
