import { NextResponse } from 'next/server'
import {
  qaSnapshotMetrics,
  criticalTickets,
  agingTickets,
  dailyPerformance,
  teamMemberPerformance,
  allTeamMembers,
  allStatuses,
  qaAIInsights,
  escapedBugsData,
} from '@/lib/dashboard-data'

export async function GET() {
  try {
    return NextResponse.json({
      metrics: qaSnapshotMetrics,
      criticalTickets,
      agingTickets,
      dailyPerformance,
      teamMembers: teamMemberPerformance,
      allMembers: allTeamMembers,
      allStatuses,
      aiInsights: qaAIInsights,
      escapedBugs: escapedBugsData,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch QA dashboard data' },
      { status: 500 }
    )
  }
}
