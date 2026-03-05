import { PrismaClient } from '@prisma/client'
import {
  qaSnapshotMetrics,
  criticalTickets,
  agingTickets,
  teamMemberPerformance,
  qaAIInsights,
  escapedBugsData,
  docSnapshotMetrics,
  docCriticalTickets,
  docAgingTickets,
  docTeamMemberPerformance,
  docAIInsights,
  crSnapshotMetrics,
  crCriticalTickets,
  crAgingTickets,
  crTeamMemberPerformance,
  crAIInsights,
} from '../lib/dashboard-data'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Clear existing data
  await prisma.activity.deleteMany()
  await prisma.teamMember.deleteMany()
  await prisma.ticket.deleteMany()
  await prisma.metrics.deleteMany()
  await prisma.aIInsight.deleteMany()
  await prisma.escapedBug.deleteMany()

  // Seed QA Dashboard
  console.log('📊 Seeding QA dashboard...')
  
  await prisma.metrics.create({
    data: {
      dashboardType: 'qa',
      spThroughputLast7: qaSnapshotMetrics.spThroughput.last7,
      spThroughputLast7Delta: qaSnapshotMetrics.spThroughput.last7Delta,
      spThroughputLast28: qaSnapshotMetrics.spThroughput.last28,
      spThroughputLast28Delta: qaSnapshotMetrics.spThroughput.last28Delta,
      spThroughputPrior7: qaSnapshotMetrics.spThroughput.prior7,
      spThroughputPrior28: qaSnapshotMetrics.spThroughput.prior28,
      paceLast7: qaSnapshotMetrics.pace.last7,
      paceLast28: qaSnapshotMetrics.pace.last28,
      assignedVolumeTotalTickets: qaSnapshotMetrics.assignedVolume.totalTickets,
      assignedVolumeTotalSP: qaSnapshotMetrics.assignedVolume.totalSP,
      assignedVolumeAgingOver7: qaSnapshotMetrics.assignedVolume.agingOver7,
      qCycleLast7: qaSnapshotMetrics.qCycle.last7,
      qCycleLast28: qaSnapshotMetrics.qCycle.last28,
      tCycleLast7: qaSnapshotMetrics.tCycle.last7,
      tCycleLast28: qaSnapshotMetrics.tCycle.last28,
      rAgeCycleLast7: qaSnapshotMetrics.rAgeCycle.last7,
      rAgeCycleLast28: qaSnapshotMetrics.rAgeCycle.last28,
      escapedDefects: qaSnapshotMetrics.escapedDefects,
      critBugsOpen: qaSnapshotMetrics.critBugs.open,
      critBugsResolved: qaSnapshotMetrics.critBugs.resolved,
    },
  })

  for (const ticket of criticalTickets) {
    await prisma.ticket.create({
      data: {
        key: ticket.key,
        recentAge: ticket.recentAge,
        age: ticket.age,
        sp: ticket.sp,
        assignee: ticket.assignee,
        developer: ticket.developer,
        returnCount: ticket.returnCount,
        firstQA: ticket.firstQA,
        latestQA: ticket.latestQA,
        status: ticket.status,
        summary: ticket.summary,
        dashboardType: 'qa',
        ticketType: 'critical',
      },
    })
  }

  for (const ticket of agingTickets) {
    await prisma.ticket.create({
      data: {
        key: ticket.key,
        recentAge: ticket.recentAge,
        age: ticket.age,
        sp: ticket.sp,
        assignee: ticket.assignee,
        developer: ticket.developer,
        returnCount: ticket.returnCount,
        firstQA: ticket.firstQA,
        latestQA: ticket.latestQA,
        status: ticket.status,
        summary: ticket.summary,
        dashboardType: 'qa',
        ticketType: 'aging',
      },
    })
  }

  for (const member of teamMemberPerformance) {
    await prisma.teamMember.create({
      data: {
        name: member.name,
        dashboardType: 'qa',
        todayTickets: member.today.tickets,
        todaySP: member.today.sp,
        todayFirstPass: member.today.firstPass,
        todayFirstPassSP: member.today.firstPassSP,
        todayRepeatPass: member.today.repeatPass,
        todayRepeatPassSP: member.today.repeatPassSP,
        todayChurn: member.today.churn,
        weeklyTickets: member.weekly.tickets,
        weeklySP: member.weekly.sp,
        weeklyFirstPass: member.weekly.firstPass,
        weeklyRepeatPass: member.weekly.repeatPass,
        weeklyAvgCycleTime: member.weekly.avgCycleTime,
        monthlyTickets: member.monthly.tickets,
        monthlySP: member.monthly.sp,
        monthlyFirstPass: member.monthly.firstPass,
        monthlyRepeatPass: member.monthly.repeatPass,
        monthlyAvgCycleTime: member.monthly.avgCycleTime,
        dailyRhythm: member.dailyRhythm,
        activities: {
          create: member.activities.map(activity => ({
            ticketKey: activity.ticketKey,
            sp: activity.sp,
            type: activity.type,
            time: activity.time,
            description: activity.description,
          })),
        },
      },
    })
  }

  for (const insight of qaAIInsights) {
    await prisma.aIInsight.create({
      data: {
        dashboardType: 'qa',
        category: insight.category,
        severity: insight.severity,
        title: insight.title,
        description: insight.description,
        affectedMembers: insight.affectedMembers.join(', '),
        recommendation: insight.recommendation,
      },
    })
  }

  for (const bug of escapedBugsData) {
    await prisma.escapedBug.create({
      data: {
        ticketKey: bug.ticketKey,
        summary: bug.summary,
        escapedFrom: bug.escapedFrom,
        detectedIn: bug.detectedIn,
        assignee: bug.assignee,
        severity: bug.severity,
        rootCause: bug.rootCause,
      },
    })
  }

  // Seed Documentation Dashboard
  console.log('📄 Seeding Documentation dashboard...')
  
  await prisma.metrics.create({
    data: {
      dashboardType: 'documentation',
      spThroughputLast7: docSnapshotMetrics.spThroughput.last7,
      spThroughputLast7Delta: docSnapshotMetrics.spThroughput.last7Delta,
      spThroughputLast28: docSnapshotMetrics.spThroughput.last28,
      spThroughputLast28Delta: docSnapshotMetrics.spThroughput.last28Delta,
      spThroughputPrior7: docSnapshotMetrics.spThroughput.prior7,
      spThroughputPrior28: docSnapshotMetrics.spThroughput.prior28,
      paceLast7: docSnapshotMetrics.pace.last7,
      paceLast28: docSnapshotMetrics.pace.last28,
      assignedVolumeTotalTickets: docSnapshotMetrics.assignedVolume.totalTickets,
      assignedVolumeTotalSP: docSnapshotMetrics.assignedVolume.totalSP,
      assignedVolumeAgingOver7: docSnapshotMetrics.assignedVolume.agingOver7,
      qCycleLast7: docSnapshotMetrics.qCycle.last7,
      qCycleLast28: docSnapshotMetrics.qCycle.last28,
      tCycleLast7: docSnapshotMetrics.tCycle.last7,
      tCycleLast28: docSnapshotMetrics.tCycle.last28,
      rAgeCycleLast7: docSnapshotMetrics.rAgeCycle.last7,
      rAgeCycleLast28: docSnapshotMetrics.rAgeCycle.last28,
      escapedDefects: docSnapshotMetrics.escapedDefects,
      critBugsOpen: docSnapshotMetrics.critBugs.open,
      critBugsResolved: docSnapshotMetrics.critBugs.resolved,
    },
  })

  for (const ticket of docCriticalTickets) {
    await prisma.ticket.create({
      data: {
        key: `doc-${ticket.key}`,
        recentAge: ticket.recentAge,
        age: ticket.age,
        sp: ticket.sp,
        assignee: ticket.assignee,
        developer: ticket.developer,
        returnCount: ticket.returnCount,
        firstQA: ticket.firstQA,
        latestQA: ticket.latestQA,
        status: ticket.status,
        summary: ticket.summary,
        dashboardType: 'documentation',
        ticketType: 'critical',
      },
    })
  }

  for (const ticket of docAgingTickets) {
    await prisma.ticket.create({
      data: {
        key: `doc-aging-${ticket.key}`,
        recentAge: ticket.recentAge,
        age: ticket.age,
        sp: ticket.sp,
        assignee: ticket.assignee,
        developer: ticket.developer,
        returnCount: ticket.returnCount,
        firstQA: ticket.firstQA,
        latestQA: ticket.latestQA,
        status: ticket.status,
        summary: ticket.summary,
        dashboardType: 'documentation',
        ticketType: 'aging',
      },
    })
  }

  for (const member of docTeamMemberPerformance) {
    await prisma.teamMember.create({
      data: {
        name: `doc-${member.name}`,
        dashboardType: 'documentation',
        todayTickets: member.today.tickets,
        todaySP: member.today.sp,
        todayFirstPass: member.today.firstPass,
        todayFirstPassSP: member.today.firstPassSP,
        todayRepeatPass: member.today.repeatPass,
        todayRepeatPassSP: member.today.repeatPassSP,
        todayChurn: member.today.churn,
        weeklyTickets: member.weekly.tickets,
        weeklySP: member.weekly.sp,
        weeklyFirstPass: member.weekly.firstPass,
        weeklyRepeatPass: member.weekly.repeatPass,
        weeklyAvgCycleTime: member.weekly.avgCycleTime,
        monthlyTickets: member.monthly.tickets,
        monthlySP: member.monthly.sp,
        monthlyFirstPass: member.monthly.firstPass,
        monthlyRepeatPass: member.monthly.repeatPass,
        monthlyAvgCycleTime: member.monthly.avgCycleTime,
        dailyRhythm: member.dailyRhythm,
        activities: {
          create: member.activities.map(activity => ({
            ticketKey: activity.ticketKey,
            sp: activity.sp,
            type: activity.type,
            time: activity.time,
            description: activity.description,
          })),
        },
      },
    })
  }

  for (const insight of docAIInsights) {
    await prisma.aIInsight.create({
      data: {
        dashboardType: 'documentation',
        category: insight.category,
        severity: insight.severity,
        title: insight.title,
        description: insight.description,
        affectedMembers: insight.affectedMembers.join(', '),
        recommendation: insight.recommendation,
      },
    })
  }

  // Seed Code Review Dashboard
  console.log('🔍 Seeding Code Review dashboard...')
  
  await prisma.metrics.create({
    data: {
      dashboardType: 'code-review',
      spThroughputLast7: crSnapshotMetrics.spThroughput.last7,
      spThroughputLast7Delta: crSnapshotMetrics.spThroughput.last7Delta,
      spThroughputLast28: crSnapshotMetrics.spThroughput.last28,
      spThroughputLast28Delta: crSnapshotMetrics.spThroughput.last28Delta,
      spThroughputPrior7: crSnapshotMetrics.spThroughput.prior7,
      spThroughputPrior28: crSnapshotMetrics.spThroughput.prior28,
      paceLast7: crSnapshotMetrics.pace.last7,
      paceLast28: crSnapshotMetrics.pace.last28,
      assignedVolumeTotalTickets: crSnapshotMetrics.assignedVolume.totalTickets,
      assignedVolumeTotalSP: crSnapshotMetrics.assignedVolume.totalSP,
      assignedVolumeAgingOver7: crSnapshotMetrics.assignedVolume.agingOver7,
      qCycleLast7: crSnapshotMetrics.qCycle.last7,
      qCycleLast28: crSnapshotMetrics.qCycle.last28,
      tCycleLast7: crSnapshotMetrics.tCycle.last7,
      tCycleLast28: crSnapshotMetrics.tCycle.last28,
      rAgeCycleLast7: crSnapshotMetrics.rAgeCycle.last7,
      rAgeCycleLast28: crSnapshotMetrics.rAgeCycle.last28,
      escapedDefects: crSnapshotMetrics.escapedDefects,
      critBugsOpen: crSnapshotMetrics.critBugs.open,
      critBugsResolved: crSnapshotMetrics.critBugs.resolved,
    },
  })

  for (const ticket of crCriticalTickets) {
    await prisma.ticket.create({
      data: {
        key: `cr-${ticket.key}`,
        recentAge: ticket.recentAge,
        age: ticket.age,
        sp: ticket.sp,
        assignee: ticket.assignee,
        developer: ticket.developer,
        returnCount: ticket.returnCount,
        firstQA: ticket.firstQA,
        latestQA: ticket.latestQA,
        status: ticket.status,
        summary: ticket.summary,
        dashboardType: 'code-review',
        ticketType: 'critical',
      },
    })
  }

  for (const ticket of crAgingTickets) {
    await prisma.ticket.create({
      data: {
        key: `cr-aging-${ticket.key}`,
        recentAge: ticket.recentAge,
        age: ticket.age,
        sp: ticket.sp,
        assignee: ticket.assignee,
        developer: ticket.developer,
        returnCount: ticket.returnCount,
        firstQA: ticket.firstQA,
        latestQA: ticket.latestQA,
        status: ticket.status,
        summary: ticket.summary,
        dashboardType: 'code-review',
        ticketType: 'aging',
      },
    })
  }

  for (const member of crTeamMemberPerformance) {
    await prisma.teamMember.create({
      data: {
        name: `cr-${member.name}`,
        dashboardType: 'code-review',
        todayTickets: member.today.tickets,
        todaySP: member.today.sp,
        todayFirstPass: member.today.firstPass,
        todayFirstPassSP: member.today.firstPassSP,
        todayRepeatPass: member.today.repeatPass,
        todayRepeatPassSP: member.today.repeatPassSP,
        todayChurn: member.today.churn,
        weeklyTickets: member.weekly.tickets,
        weeklySP: member.weekly.sp,
        weeklyFirstPass: member.weekly.firstPass,
        weeklyRepeatPass: member.weekly.repeatPass,
        weeklyAvgCycleTime: member.weekly.avgCycleTime,
        monthlyTickets: member.monthly.tickets,
        monthlySP: member.monthly.sp,
        monthlyFirstPass: member.monthly.firstPass,
        monthlyRepeatPass: member.monthly.repeatPass,
        monthlyAvgCycleTime: member.monthly.avgCycleTime,
        dailyRhythm: member.dailyRhythm,
        activities: {
          create: member.activities.map(activity => ({
            ticketKey: activity.ticketKey,
            sp: activity.sp,
            type: activity.type,
            time: activity.time,
            description: activity.description,
          })),
        },
      },
    })
  }

  for (const insight of crAIInsights) {
    await prisma.aIInsight.create({
      data: {
        dashboardType: 'code-review',
        category: insight.category,
        severity: insight.severity,
        title: insight.title,
        description: insight.description,
        affectedMembers: insight.affectedMembers.join(', '),
        recommendation: insight.recommendation,
      },
    })
  }

  console.log('✅ Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
