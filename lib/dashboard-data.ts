// ============================================================
// QA PACE Dashboard Data
// ============================================================

export interface Ticket {
  key: string
  recentAge: number
  age: number
  sp: number | null
  assignee: string
  developer: string
  returnCount: number
  firstQA: string
  latestQA: string
  status: string
  summary: string
}

export interface LeaderboardPeriod {
  tickets: number
  sp: number
  firstPass: number
  repeatPass: number
  avgCycleTime: number
}

export interface TeamMemberPerformance {
  name: string
  today: { tickets: number; sp: number; firstPass: number; firstPassSP: number; repeatPass: number; repeatPassSP: number; churn: number }
  previousDay: { tickets: number; sp: number; firstPass: number; firstPassSP: number; repeatPass: number; repeatPassSP: number; churn: number }
  weekly: LeaderboardPeriod
  monthly: LeaderboardPeriod
  dailyRhythm: string
  activities: { ticketKey: string; sp: number; type: string; time: string; description: string }[]
}

export interface SnapshotMetrics {
  spThroughput: { last7: number; last7Delta: number; last28: number; last28Delta: number; prior7: number; prior28: number }
  pace: { last7: number; last28: number }
  assignedVolume: { totalTickets: number; totalSP: number; agingOver7: number }
  qCycle: { last7: number; last28: number }
  tCycle: { last7: number | null; last28: number }
  rAgeCycle: { last7: number; last28: number }
  escapedDefects: number
  critBugs: { open: number; resolved: number }
}

// Snapshot Metrics
export const qaSnapshotMetrics: SnapshotMetrics = {
  spThroughput: { last7: 131, last7Delta: 27, last28: 507, last28Delta: 198, prior7: 104, prior28: 309 },
  pace: { last7: 67.03, last28: 282.51 },
  assignedVolume: { totalTickets: 38, totalSP: 179, agingOver7: 33 },
  qCycle: { last7: 77.68, last28: 68.13 },
  tCycle: { last7: null, last28: 3.61 },
  rAgeCycle: { last7: 6.18, last28: 6.83 },
  escapedDefects: 0,
  critBugs: { open: 0, resolved: 0 },
}

// Critical Tickets
export const criticalTickets: Ticket[] = [
  { key: "PBSCR-9894", recentAge: 3, age: 7, sp: 8, assignee: "Jordan Beebe", developer: "Joey Stapleton", returnCount: 3, firstQA: "02/13/26", latestQA: "02/19/26", status: "QA", summary: "AZGLA Season team disappearance and other deletion issues" },
  { key: "PBSCR-9895", recentAge: 2, age: 8, sp: 3, assignee: "Joey Stapleton", developer: "Jake Galiano", returnCount: 1, firstQA: "02/12/26", latestQA: "02/20/26", status: "Push Staging", summary: "Change Reporting Scheme for Uploaders to Remove TempUploaderTask" },
  { key: "PBSCR-9654", recentAge: 1, age: 5, sp: 3, assignee: "Jordan Beebe", developer: "Jake Galiano", returnCount: 3, firstQA: "02/17/26", latestQA: "02/23/26", status: "QA", summary: "Very slow load times on Master Calendar: switching from list view to calendar view" },
]

// Aging Tickets
export const agingTickets: Ticket[] = [
  { key: "PBSCR-9753", recentAge: 25, age: 25, sp: 2, assignee: "Mike Del Signore", developer: "Anirban Khara", returnCount: 0, firstQA: "01/20/26", latestQA: "01/20/26", status: "Push Staging", summary: "Make Capacity required in all site/location creation paths" },
  { key: "PBSCR-8451", recentAge: 23, age: 23, sp: 21, assignee: "Jordan Beebe", developer: "yujie zhong", returnCount: 0, firstQA: "01/23/26", latestQA: "01/23/26", status: "QA", summary: "Frontdesk Waiver Completion Flow for Pending Generic Waivers" },
  { key: "PBSCR-9025", recentAge: 22, age: 22, sp: 1, assignee: "Davi Chaves", developer: "Dylan Ameres", returnCount: 0, firstQA: "01/23/26", latestQA: "01/23/26", status: "Code Review", summary: "Core ticket tracker for APP-1868" },
  { key: "PBSCR-9763", recentAge: 19, age: 19, sp: 1, assignee: "Joey Stapleton", developer: "Alex Newman", returnCount: 0, firstQA: "01/28/26", latestQA: "01/28/26", status: "Push Staging", summary: "Error in Game Creation w/ Notify Participants toggled: Unexpected Keyword Argument in sendSeasonNotifications" },
  { key: "PBSCR-9852", recentAge: 15, age: 15, sp: null, assignee: "charlson", developer: "Ryan Saperstein", returnCount: 0, firstQA: "02/03/26", latestQA: "02/03/26", status: "QA", summary: "Core Ticket Tracker for APP-2003" },
  { key: "PBSCR-9849", recentAge: 15, age: 15, sp: 1, assignee: "charlson", developer: "Ryan Saperstein", returnCount: 0, firstQA: "02/03/26", latestQA: "02/03/26", status: "QA", summary: "Core Follow-Up Ticket: Fix Script Filtering Out Valid Sessions/Core Tracker for APP-2007" },
  { key: "PBSCR-9663", recentAge: 15, age: 26, sp: 3, assignee: "Corbin Schmeil", developer: "Alex Newman", returnCount: 4, firstQA: "01/19/26", latestQA: "02/03/26", status: "DR", summary: "Adjust 'Paid' pill for individual items on Full Receipts to include payment fees to match Credit Card Charge" },
  { key: "PBSCR-9859", recentAge: 14, age: 15, sp: 1, assignee: "Sushanth Suresh Kumar", developer: "Anirban Khara", returnCount: 1, firstQA: "02/03/26", latestQA: "02/04/26", status: "DR", summary: "Stats tab is not showing after changing site setting" },
  { key: "PBSCR-8322", recentAge: 13, age: 13, sp: 5, assignee: "Jordan Beebe", developer: "James Clarke", returnCount: 0, firstQA: "02/05/26", latestQA: "02/05/26", status: "QA", summary: "Standardize the Email All Pages and Email Selected functionality" },
  { key: "PBSCR-9661", recentAge: 11, age: 11, sp: 5, assignee: "Mike Del Signore", developer: "Anirban Khara", returnCount: 0, firstQA: "02/09/26", latestQA: "02/09/26", status: "Code Review", summary: "Core: Generic Events (USYVL) Uploader + Importer for High-Level Events" },
  { key: "PBSCR-9046", recentAge: 10, age: 10, sp: 3, assignee: "Joey Stapleton", developer: "Joey Stapleton", returnCount: 0, firstQA: "02/10/26", latestQA: "02/10/26", status: "Push Staging", summary: "Add Division Column to Game Export" },
  { key: "PBSCR-8188", recentAge: 8, age: 8, sp: 2, assignee: "Joey Stapleton", developer: "Marshall Joseph", returnCount: 0, firstQA: "02/12/26", latestQA: "02/12/26", status: "Push Staging", summary: "Date filters reset after deleting reservations on the Control Panel of the Reservation tab" },
  { key: "PBSCR-9912", recentAge: 8, age: 8, sp: null, assignee: "charlson", developer: "Dylan Ameres", returnCount: 0, firstQA: "02/12/26", latestQA: "02/12/26", status: "QA", summary: "Core ticket tracker for APP-2042" },
  { key: "PBSCR-9717", recentAge: 8, age: 13, sp: 3, assignee: "Mike Del Signore", developer: "Anirban Khara", returnCount: 1, firstQA: "02/05/26", latestQA: "02/12/26", status: "Code Review", summary: "Tournament Game Count Rules (Target 4 Games Per Team, Handle Exceptions)" },
]

// Daily QA Performance
export const dailyPerformance = {
  today: { date: "February 23, 2026", tickets: 5, sp: 11, firstPass: 2, firstPassSP: 3, repeatPass: 3, repeatPassSP: 8 },
  previous: { date: "February 20, 2026", tickets: 4, sp: 7, firstPass: 1, firstPassSP: 2, repeatPass: 3, repeatPassSP: 5 },
  last30BD: { tickets: 194, sp: 681, firstPass: 122, repeatPass: 72, repeatPassSP: 325 },
}

export const teamMemberPerformance: TeamMemberPerformance[] = [
  {
    name: "Clive Nys",
    today: { tickets: 4, sp: 9, firstPass: 2, firstPassSP: 3, repeatPass: 2, repeatPassSP: 6, churn: 50 },
    previousDay: { tickets: 1, sp: 3, firstPass: 0, firstPassSP: 0, repeatPass: 1, repeatPassSP: 3, churn: 100 },
    weekly: { tickets: 18, sp: 42, firstPass: 10, repeatPass: 8, avgCycleTime: 5.4 },
    monthly: { tickets: 72, sp: 168, firstPass: 41, repeatPass: 31, avgCycleTime: 5.8 },
    dailyRhythm: "4 actions between 12:13 PM and 04:58 PM. Significant inactivity of over 3 hours observed in the early afternoon.",
    activities: [
      { ticketKey: "PBSCR-9763", sp: 1, type: "First Pass", time: "12:13 PM", description: "Completed QA at 12:13 PM ET (1 pt, first-time pass) moving from Quality Assurance to Push Staging." },
      { ticketKey: "PBSCR-9200", sp: 3, type: "Repeat Pass #1", time: "03:16 PM", description: "Completed QA at 03:16 PM ET (3 pts, repeat pass #1) moving from Quality Assurance to Push Staging." },
      { ticketKey: "PBSCR-8188", sp: 2, type: "First Pass", time: "04:03 PM", description: "Completed QA at 04:03 PM ET (2 pts, first-time pass) moving from Quality Assurance to Push Staging." },
      { ticketKey: "PBSCR-9061", sp: 3, type: "Repeat Pass #2", time: "04:58 PM", description: "Completed QA at 04:58 PM ET (3 pts, repeat pass #2) moving from Quality Assurance to Push Staging." },
    ],
  },
  {
    name: "Jordan Beebe",
    today: { tickets: 1, sp: 2, firstPass: 0, firstPassSP: 0, repeatPass: 1, repeatPassSP: 2, churn: 100 },
    previousDay: { tickets: 2, sp: 3, firstPass: 1, firstPassSP: 1, repeatPass: 1, repeatPassSP: 2, churn: 50 },
    weekly: { tickets: 12, sp: 31, firstPass: 7, repeatPass: 5, avgCycleTime: 6.2 },
    monthly: { tickets: 52, sp: 135, firstPass: 32, repeatPass: 20, avgCycleTime: 6.5 },
    dailyRhythm: "1 action at 02:45 PM. Limited activity observed for the day.",
    activities: [
      { ticketKey: "PBSCR-9654", sp: 2, type: "Repeat Pass #3", time: "02:45 PM", description: "Completed QA at 02:45 PM ET (2 pts, repeat pass #3) moving from Quality Assurance to Push Staging." },
    ],
  },
  {
    name: "Mike Del Signore",
    today: { tickets: 0, sp: 0, firstPass: 0, firstPassSP: 0, repeatPass: 0, repeatPassSP: 0, churn: 0 },
    previousDay: { tickets: 1, sp: 1, firstPass: 0, firstPassSP: 0, repeatPass: 1, repeatPassSP: 1, churn: 100 },
    weekly: { tickets: 8, sp: 19, firstPass: 5, repeatPass: 3, avgCycleTime: 7.1 },
    monthly: { tickets: 34, sp: 82, firstPass: 22, repeatPass: 12, avgCycleTime: 7.4 },
    dailyRhythm: "No activity recorded for today.",
    activities: [],
  },
]

// All unique team members across all data
export const allTeamMembers = [
  "Clive Nys",
  "Jordan Beebe",
  "Mike Del Signore",
  "Joey Stapleton",
  "Davi Chaves",
  "charlson",
  "Corbin Schmeil",
  "Sushanth Suresh Kumar",
]

// All unique statuses
export const allStatuses = ["QA", "Push Staging", "Code Review", "DR"]

// ============================================================
// Documentation PACE Dashboard Data (rationally adjusted)
// ============================================================
export const docSnapshotMetrics: SnapshotMetrics = {
  spThroughput: { last7: 89, last7Delta: 14, last28: 342, last28Delta: 95, prior7: 75, prior28: 247 },
  pace: { last7: 45.2, last28: 189.7 },
  assignedVolume: { totalTickets: 22, totalSP: 104, agingOver7: 16 },
  qCycle: { last7: 4.2, last28: 5.8 },
  tCycle: { last7: 2.1, last28: 2.85 },
  rAgeCycle: { last7: 3.5, last28: 4.1 },
  escapedDefects: 1,
  critBugs: { open: 1, resolved: 2 },
}

export const docCriticalTickets: Ticket[] = [
  { key: "PBSCR-9901", recentAge: 5, age: 9, sp: 5, assignee: "Jordan Beebe", developer: "Dylan Ameres", returnCount: 2, firstQA: "02/10/26", latestQA: "02/18/26", status: "Documentation", summary: "API endpoint documentation for Season Management module" },
  { key: "PBSCR-9876", recentAge: 3, age: 6, sp: 3, assignee: "Mike Del Signore", developer: "Alex Newman", returnCount: 1, firstQA: "02/14/26", latestQA: "02/20/26", status: "Ready for Dev", summary: "Update integration guide for payment processing workflow" },
]

export const docAgingTickets: Ticket[] = [
  { key: "PBSCR-9801", recentAge: 18, age: 18, sp: 3, assignee: "Joey Stapleton", developer: "Ryan Saperstein", returnCount: 0, firstQA: "01/29/26", latestQA: "01/29/26", status: "Documentation", summary: "Release notes for v4.2 calendar module updates" },
  { key: "PBSCR-9780", recentAge: 15, age: 15, sp: 2, assignee: "charlson", developer: "James Clarke", returnCount: 0, firstQA: "02/03/26", latestQA: "02/03/26", status: "Ready for Dev", summary: "User guide for bulk import feature documentation" },
  { key: "PBSCR-9755", recentAge: 12, age: 12, sp: 5, assignee: "Jordan Beebe", developer: "Anirban Khara", returnCount: 1, firstQA: "02/06/26", latestQA: "02/09/26", status: "Documentation", summary: "Technical spec for event notification system overhaul" },
  { key: "PBSCR-9740", recentAge: 10, age: 14, sp: 3, assignee: "Corbin Schmeil", developer: "Jake Galiano", returnCount: 2, firstQA: "02/03/26", latestQA: "02/10/26", status: "Ready for Dev", summary: "Deployment runbook for microservices migration" },
  { key: "PBSCR-9718", recentAge: 8, age: 8, sp: 1, assignee: "Mike Del Signore", developer: "Dylan Ameres", returnCount: 0, firstQA: "02/12/26", latestQA: "02/12/26", status: "Documentation", summary: "Data dictionary updates for reporting module tables" },
]

export const docDailyPerformance = {
  today: { date: "February 23, 2026", tickets: 3, sp: 7, firstPass: 2, firstPassSP: 4, repeatPass: 1, repeatPassSP: 3 },
  previous: { date: "February 20, 2026", tickets: 2, sp: 4, firstPass: 1, firstPassSP: 2, repeatPass: 1, repeatPassSP: 2 },
  last30BD: { tickets: 112, sp: 398, firstPass: 78, repeatPass: 34, repeatPassSP: 145 },
}

export const docTeamMemberPerformance: TeamMemberPerformance[] = [
  {
    name: "Jordan Beebe",
    today: { tickets: 2, sp: 5, firstPass: 1, firstPassSP: 2, repeatPass: 1, repeatPassSP: 3, churn: 50 },
    previousDay: { tickets: 1, sp: 2, firstPass: 1, firstPassSP: 2, repeatPass: 0, repeatPassSP: 0, churn: 0 },
    weekly: { tickets: 10, sp: 24, firstPass: 6, repeatPass: 4, avgCycleTime: 4.0 },
    monthly: { tickets: 38, sp: 92, firstPass: 24, repeatPass: 14, avgCycleTime: 4.5 },
    dailyRhythm: "2 actions between 10:30 AM and 02:15 PM. Steady documentation review pace.",
    activities: [
      { ticketKey: "PBSCR-9901", sp: 3, type: "Repeat Pass #2", time: "10:30 AM", description: "Documentation marked Ready for Dev at 10:30 AM ET (3 pts, repeat pass)." },
      { ticketKey: "PBSCR-9755", sp: 2, type: "First Pass", time: "02:15 PM", description: "Documentation review completed at 02:15 PM ET (2 pts, first-time pass)." },
    ],
  },
  {
    name: "Mike Del Signore",
    today: { tickets: 1, sp: 2, firstPass: 1, firstPassSP: 2, repeatPass: 0, repeatPassSP: 0, churn: 0 },
    previousDay: { tickets: 1, sp: 2, firstPass: 0, firstPassSP: 0, repeatPass: 1, repeatPassSP: 2, churn: 100 },
    weekly: { tickets: 6, sp: 14, firstPass: 4, repeatPass: 2, avgCycleTime: 4.8 },
    monthly: { tickets: 28, sp: 64, firstPass: 19, repeatPass: 9, avgCycleTime: 5.1 },
    dailyRhythm: "1 action at 11:45 AM. Single documentation pass.",
    activities: [
      { ticketKey: "PBSCR-9876", sp: 2, type: "First Pass", time: "11:45 AM", description: "Documentation marked Ready for Dev at 11:45 AM ET (2 pts, first-time pass)." },
    ],
  },
]

export const docAllStatuses = ["Documentation", "Ready for Dev", "In Review", "DR"]

// ============================================================
// Code Review PACE Dashboard Data (rationally adjusted)
// ============================================================
export const crSnapshotMetrics: SnapshotMetrics = {
  spThroughput: { last7: 108, last7Delta: 19, last28: 423, last28Delta: 132, prior7: 89, prior28: 291 },
  pace: { last7: 54.8, last28: 231.6 },
  assignedVolume: { totalTickets: 29, totalSP: 142, agingOver7: 21 },
  qCycle: { last7: 3.2, last28: 4.5 },
  tCycle: { last7: 1.8, last28: 2.4 },
  rAgeCycle: { last7: 2.9, last28: 3.7 },
  escapedDefects: 0,
  critBugs: { open: 0, resolved: 1 },
}

export const crCriticalTickets: Ticket[] = [
  { key: "PBSCR-9920", recentAge: 4, age: 7, sp: 5, assignee: "Davi Chaves", developer: "Anirban Khara", returnCount: 2, firstQA: "02/12/26", latestQA: "02/19/26", status: "Code Review", summary: "Refactor payment gateway integration for multi-currency support" },
  { key: "PBSCR-9908", recentAge: 3, age: 5, sp: 8, assignee: "Joey Stapleton", developer: "James Clarke", returnCount: 1, firstQA: "02/15/26", latestQA: "02/20/26", status: "Ready for Dev", summary: "Performance optimization for calendar event rendering pipeline" },
]

export const crAgingTickets: Ticket[] = [
  { key: "PBSCR-9025", recentAge: 22, age: 22, sp: 1, assignee: "Davi Chaves", developer: "Dylan Ameres", returnCount: 0, firstQA: "01/23/26", latestQA: "01/23/26", status: "Code Review", summary: "Core ticket tracker for APP-1868" },
  { key: "PBSCR-9661", recentAge: 11, age: 11, sp: 5, assignee: "Mike Del Signore", developer: "Anirban Khara", returnCount: 0, firstQA: "02/09/26", latestQA: "02/09/26", status: "Code Review", summary: "Core: Generic Events (USYVL) Uploader + Importer for High-Level Events" },
  { key: "PBSCR-9717", recentAge: 8, age: 13, sp: 3, assignee: "Mike Del Signore", developer: "Anirban Khara", returnCount: 1, firstQA: "02/05/26", latestQA: "02/12/26", status: "Code Review", summary: "Tournament Game Count Rules (Target 4 Games Per Team, Handle Exceptions)" },
  { key: "PBSCR-9830", recentAge: 6, age: 10, sp: 3, assignee: "Jordan Beebe", developer: "Ryan Saperstein", returnCount: 1, firstQA: "02/08/26", latestQA: "02/14/26", status: "Ready for Dev", summary: "Waiver signature capture component code cleanup and test coverage" },
  { key: "PBSCR-9845", recentAge: 5, age: 5, sp: 2, assignee: "Joey Stapleton", developer: "Alex Newman", returnCount: 0, firstQA: "02/16/26", latestQA: "02/16/26", status: "Code Review", summary: "Accessibility audit fixes for registration flow forms" },
]

export const crDailyPerformance = {
  today: { date: "February 23, 2026", tickets: 4, sp: 9, firstPass: 3, firstPassSP: 6, repeatPass: 1, repeatPassSP: 3 },
  previous: { date: "February 20, 2026", tickets: 3, sp: 6, firstPass: 2, firstPassSP: 4, repeatPass: 1, repeatPassSP: 2 },
  last30BD: { tickets: 156, sp: 542, firstPass: 105, repeatPass: 51, repeatPassSP: 198 },
}

export const crTeamMemberPerformance: TeamMemberPerformance[] = [
  {
    name: "Davi Chaves",
    today: { tickets: 2, sp: 4, firstPass: 2, firstPassSP: 4, repeatPass: 0, repeatPassSP: 0, churn: 0 },
    previousDay: { tickets: 1, sp: 3, firstPass: 1, firstPassSP: 3, repeatPass: 0, repeatPassSP: 0, churn: 0 },
    weekly: { tickets: 14, sp: 32, firstPass: 10, repeatPass: 4, avgCycleTime: 2.9 },
    monthly: { tickets: 56, sp: 128, firstPass: 40, repeatPass: 16, avgCycleTime: 3.2 },
    dailyRhythm: "2 actions between 09:15 AM and 11:30 AM. Focused morning code review session.",
    activities: [
      { ticketKey: "PBSCR-9845", sp: 2, type: "First Pass", time: "09:15 AM", description: "Code review completed at 09:15 AM ET (2 pts, first-time pass) moving to Ready for Dev." },
      { ticketKey: "PBSCR-9025", sp: 2, type: "First Pass", time: "11:30 AM", description: "Code review completed at 11:30 AM ET (2 pts, first-time pass) moving to Ready for Dev." },
    ],
  },
  {
    name: "Joey Stapleton",
    today: { tickets: 2, sp: 5, firstPass: 1, firstPassSP: 2, repeatPass: 1, repeatPassSP: 3, churn: 50 },
    previousDay: { tickets: 2, sp: 3, firstPass: 1, firstPassSP: 1, repeatPass: 1, repeatPassSP: 2, churn: 50 },
    weekly: { tickets: 11, sp: 26, firstPass: 6, repeatPass: 5, avgCycleTime: 3.4 },
    monthly: { tickets: 44, sp: 108, firstPass: 26, repeatPass: 18, avgCycleTime: 3.8 },
    dailyRhythm: "2 actions between 01:00 PM and 03:45 PM. Afternoon code review block.",
    activities: [
      { ticketKey: "PBSCR-9908", sp: 3, type: "Repeat Pass #1", time: "01:00 PM", description: "Code review completed at 01:00 PM ET (3 pts, repeat pass #1) moving to Ready for Dev." },
      { ticketKey: "PBSCR-9920", sp: 2, type: "First Pass", time: "03:45 PM", description: "Code review completed at 03:45 PM ET (2 pts, first-time pass) approved and merged." },
    ],
  },
]

export const crAllStatuses = ["Code Review", "Ready for Dev", "Approved", "DR"]

// ============================================================
// Infrastructure Dashboard Data
// ============================================================

export interface InfraPaceItem {
  id: string
  description: string
  type: "RICE Ticket" | "Jira Task" | "Weekly Summary"
  source: "Documentation Team" | "CTO Approval" | "Weekly Review"
  sp: number
  completedDate: string
  assignee: string
}

export interface InfraHealthMetric {
  label: string
  current: number
  previous: number
  unit: string
  trend: "up" | "down" | "stable"
  isGoodWhenLow?: boolean
}

export interface AWSClientMetric {
  clientName: string
  monthlyRevenue: number
  awsCost: number
  costAsPercentOfRevenue: number
}

export const infraPaceItems: InfraPaceItem[] = [
  { id: "INFRA-001", description: "Implement Redis caching for session management", type: "RICE Ticket", source: "Documentation Team", sp: 8, completedDate: "02/20/26", assignee: "Dylan Ameres" },
  { id: "INFRA-002", description: "Database query optimization for reporting module", type: "RICE Ticket", source: "Documentation Team", sp: 13, completedDate: "02/18/26", assignee: "Jake Galiano" },
  { id: "INFRA-003", description: "Setup auto-scaling policies for peak traffic", type: "Jira Task", source: "CTO Approval", sp: 5, completedDate: "02/22/26", assignee: "Anirban Khara" },
  { id: "INFRA-004", description: "Migrate staging environment to new AWS region", type: "Jira Task", source: "CTO Approval", sp: 8, completedDate: "02/19/26", assignee: "Dylan Ameres" },
  { id: "INFRA-005", description: "Implement CDN caching for static assets", type: "RICE Ticket", source: "Documentation Team", sp: 5, completedDate: "02/15/26", assignee: "James Clarke" },
  { id: "INFRA-006", description: "Weekly infrastructure review - monitoring improvements", type: "Weekly Summary", source: "Weekly Review", sp: 3, completedDate: "02/21/26", assignee: "Mike Del Signore" },
  { id: "INFRA-007", description: "API rate limiting implementation", type: "RICE Ticket", source: "Documentation Team", sp: 8, completedDate: "02/14/26", assignee: "Joey Stapleton" },
  { id: "INFRA-008", description: "Setup CloudWatch alarms for critical services", type: "Jira Task", source: "CTO Approval", sp: 3, completedDate: "02/17/26", assignee: "Anirban Khara" },
  { id: "INFRA-009", description: "Database connection pooling optimization", type: "RICE Ticket", source: "Documentation Team", sp: 5, completedDate: "02/12/26", assignee: "Dylan Ameres" },
  { id: "INFRA-010", description: "Weekly infrastructure review - security patches", type: "Weekly Summary", source: "Weekly Review", sp: 2, completedDate: "02/14/26", assignee: "Mike Del Signore" },
]

export const infraHealthMetrics: InfraHealthMetric[] = [
  { label: "Timeouts (24h)", current: 47, previous: 62, unit: "count", trend: "down", isGoodWhenLow: true },
  { label: "404 Errors (24h)", current: 128, previous: 145, unit: "count", trend: "down", isGoodWhenLow: true },
  { label: "Timeouts (7d)", current: 312, previous: 418, unit: "count", trend: "down", isGoodWhenLow: true },
  { label: "404 Errors (7d)", current: 892, previous: 1024, unit: "count", trend: "down", isGoodWhenLow: true },
  { label: "Avg Response Time", current: 245, previous: 312, unit: "ms", trend: "down", isGoodWhenLow: true },
  { label: "Uptime (30d)", current: 99.94, previous: 99.87, unit: "%", trend: "up", isGoodWhenLow: false },
]

export const awsClientMetrics: AWSClientMetric[] = [
  { clientName: "AZGLA", monthlyRevenue: 42500, awsCost: 3825, costAsPercentOfRevenue: 9.0 },
  { clientName: "SportsHub Pro", monthlyRevenue: 28000, awsCost: 2940, costAsPercentOfRevenue: 10.5 },
  { clientName: "LeagueRunner", monthlyRevenue: 18500, awsCost: 1665, costAsPercentOfRevenue: 9.0 },
  { clientName: "TeamTracker Elite", monthlyRevenue: 15000, awsCost: 1425, costAsPercentOfRevenue: 9.5 },
  { clientName: "RecLeague Manager", monthlyRevenue: 12000, awsCost: 1320, costAsPercentOfRevenue: 11.0 },
  { clientName: "YouthSports Central", monthlyRevenue: 9500, awsCost: 902, costAsPercentOfRevenue: 9.5 },
  { clientName: "ClubConnect", monthlyRevenue: 8200, awsCost: 820, costAsPercentOfRevenue: 10.0 },
  { clientName: "FacilityPro", monthlyRevenue: 6800, awsCost: 612, costAsPercentOfRevenue: 9.0 },
]

export const infraPaceSummary = {
  last7Days: { totalSP: 24, riceTickets: 13, jiraTasks: 8, weeklySummary: 3, itemCount: 4 },
  last14Days: { totalSP: 47, riceTickets: 31, jiraTasks: 11, weeklySummary: 5, itemCount: 7 },
  last30Days: { totalSP: 60, riceTickets: 39, jiraTasks: 16, weeklySummary: 5, itemCount: 10 },
}

// ============================================================
// Support Pace Dashboard Data
// ============================================================

export type SupportPriority = "Critical" | "High" | "Medium" | "Low"
export type SupportStatus = "Resolved" | "Open" | "In Progress" | "Pending Client"

export interface SupportIssue {
  id: string
  clientName: string
  summary: string
  priority: SupportPriority
  weight: number // 1-10 weight for pace calculation
  status: SupportStatus
  assignee: string
  dateOpened: string
  dateResolved: string | null
  hoursToResolve: number | null
  exceeds24Hours: boolean
}

export interface SupportMemberStats {
  name: string
  issuesSolved: number
  weightedPace: number
  avgResolutionHours: number
  over24HourCount: number
}

export const supportIssuesData: SupportIssue[] = [
  { id: "SUP-001", clientName: "AZGLA", summary: "Unable to access tournament bracket after playoff creation", priority: "Critical", weight: 10, status: "Resolved", assignee: "Jordan Beebe", dateOpened: "02/20/26", dateResolved: "02/20/26", hoursToResolve: 4.5, exceeds24Hours: false },
  { id: "SUP-002", clientName: "SportsHub Pro", summary: "Payment processing timeout during registration peak", priority: "Critical", weight: 10, status: "Resolved", assignee: "Mike Del Signore", dateOpened: "02/19/26", dateResolved: "02/19/26", hoursToResolve: 2.8, exceeds24Hours: false },
  { id: "SUP-003", clientName: "LeagueRunner", summary: "Duplicate email notifications sent for game changes", priority: "High", weight: 7, status: "Resolved", assignee: "Joey Stapleton", dateOpened: "02/18/26", dateResolved: "02/19/26", hoursToResolve: 28.5, exceeds24Hours: true },
  { id: "SUP-004", clientName: "TeamTracker Elite", summary: "CSV export missing custom field data", priority: "Medium", weight: 5, status: "Resolved", assignee: "Jordan Beebe", dateOpened: "02/17/26", dateResolved: "02/18/26", hoursToResolve: 18.2, exceeds24Hours: false },
  { id: "SUP-005", clientName: "RecLeague Manager", summary: "Mobile app crash on player roster view", priority: "High", weight: 8, status: "Open", assignee: "charlson", dateOpened: "02/21/26", dateResolved: null, hoursToResolve: null, exceeds24Hours: true },
  { id: "SUP-006", clientName: "YouthSports Central", summary: "Schedule conflict detection not working properly", priority: "High", weight: 7, status: "In Progress", assignee: "Clive Nys", dateOpened: "02/22/26", dateResolved: null, hoursToResolve: null, exceeds24Hours: false },
  { id: "SUP-007", clientName: "ClubConnect", summary: "Waiver signature not saving on iOS devices", priority: "Critical", weight: 9, status: "Resolved", assignee: "Mike Del Signore", dateOpened: "02/15/26", dateResolved: "02/16/26", hoursToResolve: 26.3, exceeds24Hours: true },
  { id: "SUP-008", clientName: "FacilityPro", summary: "Report date range filter returning wrong data", priority: "Medium", weight: 4, status: "Resolved", assignee: "Joey Stapleton", dateOpened: "02/14/26", dateResolved: "02/14/26", hoursToResolve: 6.1, exceeds24Hours: false },
  { id: "SUP-009", clientName: "AZGLA", summary: "Division standings calculation incorrect after forfeit", priority: "High", weight: 8, status: "Pending Client", assignee: "Jordan Beebe", dateOpened: "02/20/26", dateResolved: null, hoursToResolve: null, exceeds24Hours: true },
  { id: "SUP-010", clientName: "SportsHub Pro", summary: "API rate limit hit during bulk team import", priority: "Medium", weight: 5, status: "Resolved", assignee: "Clive Nys", dateOpened: "02/12/26", dateResolved: "02/13/26", hoursToResolve: 22.4, exceeds24Hours: false },
  { id: "SUP-011", clientName: "TeamTracker Elite", summary: "Calendar sync with Google not updating properly", priority: "Medium", weight: 5, status: "Open", assignee: "charlson", dateOpened: "02/22/26", dateResolved: null, hoursToResolve: null, exceeds24Hours: false },
  { id: "SUP-012", clientName: "LeagueRunner", summary: "Parent portal login redirect loop", priority: "Critical", weight: 10, status: "Resolved", assignee: "Mike Del Signore", dateOpened: "02/21/26", dateResolved: "02/21/26", hoursToResolve: 3.2, exceeds24Hours: false },
]

export const supportMemberStats: SupportMemberStats[] = [
  { name: "Jordan Beebe", issuesSolved: 2, weightedPace: 15.0, avgResolutionHours: 11.4, over24HourCount: 0 },
  { name: "Mike Del Signore", issuesSolved: 3, weightedPace: 29.0, avgResolutionHours: 10.8, over24HourCount: 1 },
  { name: "Joey Stapleton", issuesSolved: 2, weightedPace: 11.0, avgResolutionHours: 17.3, over24HourCount: 1 },
  { name: "Clive Nys", issuesSolved: 1, weightedPace: 5.0, avgResolutionHours: 22.4, over24HourCount: 0 },
  { name: "charlson", issuesSolved: 0, weightedPace: 0, avgResolutionHours: 0, over24HourCount: 0 },
]

export const supportPaceSummary = {
  last7Days: { totalWeightedPace: 60.0, issuesSolved: 8, avgResolutionHours: 14.2, over24HourCount: 3, openIssues: 4 },
  last14Days: { totalWeightedPace: 78.0, issuesSolved: 10, avgResolutionHours: 15.8, over24HourCount: 4, openIssues: 4 },
  last30Days: { totalWeightedPace: 95.0, issuesSolved: 12, avgResolutionHours: 16.4, over24HourCount: 5, openIssues: 4 },
}

// ============================================================
// Bug Analysis Data (for Testing/QA tab)
// ============================================================

export type BugSeverity = "Critical" | "Semi-Critical"

export interface BugAnalysisEntry {
  id: string
  ticketKey: string
  summary: string
  severity: BugSeverity
  impactScore: number // 1-10
  causedByDev: string
  causedByCodeReviewer: string
  causedByQA: string
  datePushed: string
  dateDiscovered: string
  qaPacePenalty: number // SP penalty for QA person
  crPacePenalty: number // SP penalty for code reviewer
  lessonsLearned: string
}

export const bugAnalysisData: BugAnalysisEntry[] = [
  {
    id: "BUG-001",
    ticketKey: "PBSCR-9894",
    summary: "AZGLA Season team disappearance and other deletion issues",
    severity: "Critical",
    impactScore: 9,
    causedByDev: "Joey Stapleton",
    causedByCodeReviewer: "Davi Chaves",
    causedByQA: "Jordan Beebe",
    datePushed: "02/10/26",
    dateDiscovered: "02/13/26",
    qaPacePenalty: -4.2,
    crPacePenalty: -3.8,
    lessonsLearned: "Cascade deletes not tested against season-team relationships. Add integration tests for all delete paths involving parent-child entities.",
  },
  {
    id: "BUG-002",
    ticketKey: "PBSCR-9654",
    summary: "Very slow load times on Master Calendar: list to calendar view switch",
    severity: "Critical",
    impactScore: 8,
    causedByDev: "Jake Galiano",
    causedByCodeReviewer: "Joey Stapleton",
    causedByQA: "Jordan Beebe",
    datePushed: "02/14/26",
    dateDiscovered: "02/17/26",
    qaPacePenalty: -3.5,
    crPacePenalty: -2.8,
    lessonsLearned: "No performance testing on views with >500 events. Mandate load testing when query involves date-range aggregation across large datasets.",
  },
  {
    id: "BUG-003",
    ticketKey: "PBSCR-9895",
    summary: "Change Reporting Scheme for Uploaders to Remove TempUploaderTask",
    severity: "Semi-Critical",
    impactScore: 6,
    causedByDev: "Jake Galiano",
    causedByCodeReviewer: "Mike Del Signore",
    causedByQA: "Joey Stapleton",
    datePushed: "02/08/26",
    dateDiscovered: "02/12/26",
    qaPacePenalty: -1.8,
    crPacePenalty: -2.2,
    lessonsLearned: "Legacy TempUploaderTask reference not fully removed from async queue. Code reviewer should have caught unused import pattern.",
  },
  {
    id: "BUG-004",
    ticketKey: "PBSCR-9763",
    summary: "Error in Game Creation w/ Notify Participants toggled: sendSeasonNotifications",
    severity: "Semi-Critical",
    impactScore: 5,
    causedByDev: "Alex Newman",
    causedByCodeReviewer: "Dylan Ameres",
    causedByQA: "Clive Nys",
    datePushed: "01/24/26",
    dateDiscovered: "01/28/26",
    qaPacePenalty: -1.2,
    crPacePenalty: -1.5,
    lessonsLearned: "Keyword argument mismatch between Python function signature and caller. Add type checking and lint rules for function call argument validation.",
  },
  {
    id: "BUG-005",
    ticketKey: "PBSCR-9859",
    summary: "Stats tab not showing after changing site setting",
    severity: "Semi-Critical",
    impactScore: 4,
    causedByDev: "Anirban Khara",
    causedByCodeReviewer: "Joey Stapleton",
    causedByQA: "Sushanth Suresh Kumar",
    datePushed: "02/01/26",
    dateDiscovered: "02/03/26",
    qaPacePenalty: -0.8,
    crPacePenalty: -1.0,
    lessonsLearned: "Site setting toggle did not invalidate cached stats component. Ensure cache invalidation is tested when config-dependent components are modified.",
  },
  {
    id: "BUG-006",
    ticketKey: "PBSCR-9663",
    summary: "Adjust 'Paid' pill for individual items on Full Receipts - payment fees mismatch",
    severity: "Critical",
    impactScore: 7,
    causedByDev: "Alex Newman",
    causedByCodeReviewer: "Davi Chaves",
    causedByQA: "Corbin Schmeil",
    datePushed: "01/15/26",
    dateDiscovered: "01/19/26",
    qaPacePenalty: -2.5,
    crPacePenalty: -3.0,
    lessonsLearned: "Payment fee calculation excluded platform surcharge in edge case. Financial calculations require dedicated unit tests with boundary values.",
  },
  {
    id: "BUG-007",
    ticketKey: "PBSCR-9912",
    summary: "Core ticket tracker for APP-2042 - missing field validation",
    severity: "Semi-Critical",
    impactScore: 3,
    causedByDev: "Dylan Ameres",
    causedByCodeReviewer: "Mike Del Signore",
    causedByQA: "charlson",
    datePushed: "02/09/26",
    dateDiscovered: "02/12/26",
    qaPacePenalty: -0.6,
    crPacePenalty: -0.8,
    lessonsLearned: "Required field validation skipped on backend for tracker creation endpoint. Add schema validation middleware to all CRUD endpoints.",
  },
]

// ============================================================
// AI Insights Data (for all PACE tabs)
// ============================================================

export type InsightCause = "Process Gap" | "Communication" | "Technical Debt" | "Training Needed" | "Resource Constraint"

export interface AIInsight {
  id: string
  person: string
  category: InsightCause
  severity: "High" | "Medium" | "Low"
  insight: string
  recommendation: string
  detectedDate: string
  relatedTickets: string[]
}

export const qaAIInsights: AIInsight[] = [
  { id: "QI-001", person: "Jordan Beebe", category: "Process Gap", severity: "High", insight: "Repeated QA cycles on calendar-related tickets averaging 3.2 passes vs team average of 1.8", recommendation: "Implement calendar-specific test checklist and pre-QA dev verification", detectedDate: "02/20/26", relatedTickets: ["PBSCR-9654", "PBSCR-9894"] },
  { id: "QI-002", person: "charlson", category: "Technical Debt", severity: "Medium", insight: "Core tracker tickets consistently aging 15+ days due to unclear acceptance criteria", recommendation: "Require detailed AC sign-off before QA assignment for core tickets", detectedDate: "02/18/26", relatedTickets: ["PBSCR-9852", "PBSCR-9849", "PBSCR-9912"] },
  { id: "QI-003", person: "Clive Nys", category: "Training Needed", severity: "Medium", insight: "Performance-related bugs missed in initial QA pass - 60% escape rate on perf issues", recommendation: "Performance testing workshop and automated perf regression suite", detectedDate: "02/15/26", relatedTickets: ["PBSCR-9654"] },
  { id: "QI-004", person: "Mike Del Signore", category: "Resource Constraint", severity: "Low", insight: "Code Review backlog causing QA delays - 8 tickets in CR > 7 days", recommendation: "Allocate dedicated CR slots or add CR capacity", detectedDate: "02/22/26", relatedTickets: ["PBSCR-9661", "PBSCR-9717"] },
  { id: "QI-005", person: "Joey Stapleton", category: "Communication", severity: "Medium", insight: "Staging deployment coordination gaps - 3 tickets pushed without QA notification", recommendation: "Implement automated staging deployment alerts to QA channel", detectedDate: "02/19/26", relatedTickets: ["PBSCR-9046", "PBSCR-8188"] },
]

export const docAIInsights: AIInsight[] = [
  { id: "DI-001", person: "Jordan Beebe", category: "Process Gap", severity: "High", insight: "API documentation lagging feature releases by average 12 days", recommendation: "Mandate doc-complete as PR merge criteria for API changes", detectedDate: "02/21/26", relatedTickets: ["PBSCR-9901"] },
  { id: "DI-002", person: "Corbin Schmeil", category: "Technical Debt", severity: "Medium", insight: "Deployment runbooks missing rollback procedures for 40% of services", recommendation: "Audit all runbooks and add standardized rollback sections", detectedDate: "02/17/26", relatedTickets: ["PBSCR-9740"] },
  { id: "DI-003", person: "Mike Del Signore", category: "Communication", severity: "Low", insight: "Data dictionary updates not synced with schema migrations", recommendation: "Add data dictionary update to migration PR template", detectedDate: "02/14/26", relatedTickets: ["PBSCR-9718"] },
]

export const crAIInsights: AIInsight[] = [
  { id: "CI-001", person: "Davi Chaves", category: "Technical Debt", severity: "High", insight: "Multi-currency payment code has 0% test coverage - high risk area", recommendation: "Mandate 80% coverage for payment-related PRs before approval", detectedDate: "02/20/26", relatedTickets: ["PBSCR-9920"] },
  { id: "CI-002", person: "Joey Stapleton", category: "Process Gap", severity: "Medium", insight: "Performance PRs approved without load test results - 2 regressions this month", recommendation: "Add performance benchmark requirement to PR template", detectedDate: "02/18/26", relatedTickets: ["PBSCR-9908"] },
  { id: "CI-003", person: "Mike Del Signore", category: "Resource Constraint", severity: "Medium", insight: "Complex PRs (>500 LOC) averaging 6 day review time vs 2 day target", recommendation: "Split large PRs or add secondary reviewer for complex changes", detectedDate: "02/16/26", relatedTickets: ["PBSCR-9661", "PBSCR-9717"] },
  { id: "CI-004", person: "Jordan Beebe", category: "Training Needed", severity: "Low", insight: "Accessibility audit fixes require specialized review knowledge", recommendation: "A11y review training for at least 2 team members", detectedDate: "02/15/26", relatedTickets: ["PBSCR-9845"] },
]

// ============================================================
// Escaped Bugs Data (for QA tab)
// ============================================================

export interface EscapedBug {
  id: string
  ticketKey: string
  summary: string
  severity: BugSeverity
  environment: "Production" | "Staging" | "Beta"
  escapedFrom: "QA" | "Code Review" | "Both"
  qaOwner: string
  codeReviewer: string
  developer: string
  datePushed: string
  dateFound: string
  daysToDetect: number
  rootCause: string
  customerImpact: string
}

export const escapedBugsData: EscapedBug[] = [
  { id: "EB-001", ticketKey: "PBSCR-9894", summary: "Season team cascade delete removes active teams", severity: "Critical", environment: "Production", escapedFrom: "Both", qaOwner: "Jordan Beebe", codeReviewer: "Davi Chaves", developer: "Joey Stapleton", datePushed: "02/10/26", dateFound: "02/13/26", daysToDetect: 3, rootCause: "Missing integration test for cascade delete path", customerImpact: "12 leagues affected, manual data restoration required" },
  { id: "EB-002", ticketKey: "PBSCR-9654", summary: "Calendar view switch causes 30s+ load time with >500 events", severity: "Critical", environment: "Production", escapedFrom: "QA", qaOwner: "Jordan Beebe", codeReviewer: "Joey Stapleton", developer: "Jake Galiano", datePushed: "02/14/26", dateFound: "02/17/26", daysToDetect: 3, rootCause: "No performance testing on large datasets", customerImpact: "Major client complaints, temporary feature disable" },
  { id: "EB-003", ticketKey: "PBSCR-9663", summary: "Payment fee calculation incorrect for partial refunds", severity: "Critical", environment: "Production", escapedFrom: "Both", qaOwner: "Corbin Schmeil", codeReviewer: "Davi Chaves", developer: "Alex Newman", datePushed: "01/15/26", dateFound: "01/19/26", daysToDetect: 4, rootCause: "Edge case not in test scenarios", customerImpact: "Financial reconciliation errors, manual corrections needed" },
  { id: "EB-004", ticketKey: "PBSCR-9895", summary: "TempUploaderTask reference causing async job failures", severity: "Semi-Critical", environment: "Staging", escapedFrom: "Code Review", qaOwner: "Joey Stapleton", codeReviewer: "Mike Del Signore", developer: "Jake Galiano", datePushed: "02/08/26", dateFound: "02/12/26", daysToDetect: 4, rootCause: "Incomplete code cleanup after refactor", customerImpact: "Batch uploads failing silently" },
  { id: "EB-005", ticketKey: "PBSCR-9763", summary: "sendSeasonNotifications keyword argument mismatch", severity: "Semi-Critical", environment: "Production", escapedFrom: "Both", qaOwner: "Clive Nys", codeReviewer: "Dylan Ameres", developer: "Alex Newman", datePushed: "01/24/26", dateFound: "01/28/26", daysToDetect: 4, rootCause: "No type checking on function calls", customerImpact: "Notifications not sent for 200+ games" },
  { id: "EB-006", ticketKey: "PBSCR-9859", summary: "Stats tab hidden after site setting change", severity: "Semi-Critical", environment: "Production", escapedFrom: "QA", qaOwner: "Sushanth Suresh Kumar", codeReviewer: "Joey Stapleton", developer: "Anirban Khara", datePushed: "02/01/26", dateFound: "02/03/26", daysToDetect: 2, rootCause: "Cache invalidation not tested", customerImpact: "Stats inaccessible for affected sites" },
  { id: "EB-007", ticketKey: "PBSCR-9912", summary: "Missing required field validation on tracker creation", severity: "Semi-Critical", environment: "Beta", escapedFrom: "Code Review", qaOwner: "charlson", codeReviewer: "Mike Del Signore", developer: "Dylan Ameres", datePushed: "02/09/26", dateFound: "02/12/26", daysToDetect: 3, rootCause: "Backend validation skipped", customerImpact: "Invalid tracker entries created" },
]

// ============================================================
// TRIPS Summary Data
// T = Testing / QA Pace
// R = Review (Code Review) Pace
// I = Infrastructure Improvement Pace
// P = PRD Ready for Dev (Documentation) Pace
// S = Support Pace
// ============================================================

export interface TripsPaceWindow {
  day5: number
  day10: number
  day21_5: number
  day64_5: number
}

export interface TripsMetric {
  key: "T" | "R" | "I" | "P" | "S"
  label: string
  fullLabel: string
  spThroughput: TripsPaceWindow
  pace: TripsPaceWindow
  cycleTime: TripsPaceWindow
  returnRate: TripsPaceWindow
  volume: TripsPaceWindow
}

export interface DevPaceMetric {
  label: string
  spThroughput: TripsPaceWindow
  pace: TripsPaceWindow
  cycleTime: TripsPaceWindow
  prMergeRate: TripsPaceWindow
  deployFrequency: TripsPaceWindow
}

export const tripsMetrics: TripsMetric[] = [
  {
    key: "T",
    label: "T - Testing",
    fullLabel: "Testing / QA Pace",
    spThroughput: { day5: 47, day10: 98, day21_5: 231, day64_5: 681 },
    pace: { day5: 24.1, day10: 49.8, day21_5: 115.3, day64_5: 282.5 },
    cycleTime: { day5: 5.2, day10: 6.1, day21_5: 6.8, day64_5: 7.4 },
    returnRate: { day5: 42, day10: 38, day21_5: 35, day64_5: 37 },
    volume: { day5: 14, day10: 27, day21_5: 62, day64_5: 179 },
  },
  {
    key: "R",
    label: "R - Review",
    fullLabel: "Code Review Pace",
    spThroughput: { day5: 39, day10: 81, day21_5: 192, day64_5: 542 },
    pace: { day5: 19.7, day10: 41.2, day21_5: 98.6, day64_5: 231.6 },
    cycleTime: { day5: 2.8, day10: 3.1, day21_5: 3.5, day64_5: 4.5 },
    returnRate: { day5: 28, day10: 25, day21_5: 22, day64_5: 24 },
    volume: { day5: 11, day10: 22, day21_5: 51, day64_5: 142 },
  },
  {
    key: "I",
    label: "I - Infrastructure",
    fullLabel: "Infrastructure Improvement Pace",
    spThroughput: { day5: 12, day10: 28, day21_5: 64, day64_5: 185 },
    pace: { day5: 6.1, day10: 14.2, day21_5: 33.8, day64_5: 92.4 },
    cycleTime: { day5: 8.4, day10: 9.2, day21_5: 10.1, day64_5: 11.3 },
    returnRate: { day5: 15, day10: 18, day21_5: 20, day64_5: 19 },
    volume: { day5: 4, day10: 8, day21_5: 19, day64_5: 52 },
  },
  {
    key: "P",
    label: "P - PRD / Docs",
    fullLabel: "PRD Ready for Dev (Documentation) Pace",
    spThroughput: { day5: 32, day10: 67, day21_5: 155, day64_5: 398 },
    pace: { day5: 16.2, day10: 33.8, day21_5: 79.4, day64_5: 189.7 },
    cycleTime: { day5: 3.8, day10: 4.2, day21_5: 4.9, day64_5: 5.8 },
    returnRate: { day5: 32, day10: 30, day21_5: 28, day64_5: 31 },
    volume: { day5: 9, day10: 17, day21_5: 38, day64_5: 104 },
  },
  {
    key: "S",
    label: "S - Support",
    fullLabel: "Support Pace",
    spThroughput: { day5: 18, day10: 38, day21_5: 88, day64_5: 245 },
    pace: { day5: 9.3, day10: 19.1, day21_5: 44.2, day64_5: 121.8 },
    cycleTime: { day5: 1.4, day10: 1.8, day21_5: 2.2, day64_5: 2.6 },
    returnRate: { day5: 8, day10: 10, day21_5: 12, day64_5: 11 },
    volume: { day5: 7, day10: 14, day21_5: 32, day64_5: 87 },
  },
]

export const devPaceMetrics: DevPaceMetric = {
  label: "Software Dev Pace",
  spThroughput: { day5: 82, day10: 171, day21_5: 402, day64_5: 1187 },
  pace: { day5: 41.5, day10: 86.2, day21_5: 204.8, day64_5: 594.2 },
  cycleTime: { day5: 3.1, day10: 3.4, day21_5: 3.8, day64_5: 4.2 },
  prMergeRate: { day5: 18, day10: 37, day21_5: 84, day64_5: 248 },
  deployFrequency: { day5: 6, day10: 13, day21_5: 28, day64_5: 82 },
}

// ============================================================
// TRIPS Per-Member Pace Data (by configurable window)
// ============================================================

export interface TripsMemberPace {
  name: string
  pace: Record<number, number> // keyed by days: 7, 14, 30
  sp: Record<number, number>
  tickets: Record<number, number>
  avg60DailyPace: number // 60-day average daily pace (used to compute expected pace for any window)
}

export interface TripsLetterTeam {
  key: "T" | "R" | "I" | "P" | "S"
  label: string
  fullLabel: string
  members: TripsMemberPace[]
}

export const tripsTeams: TripsLetterTeam[] = [
  {
    key: "T",
    label: "T - Testing / QA",
    fullLabel: "Testing / QA Pace",
    members: [
      { name: "Jordan Beebe", pace: { 7: 12.4, 14: 26.1, 30: 58.2 }, sp: { 7: 18, 14: 38, 30: 82 }, tickets: { 7: 6, 14: 13, 30: 28 }, avg60DailyPace: 1.82 },
      { name: "charlson", pace: { 7: 8.2, 14: 17.5, 30: 38.8 }, sp: { 7: 12, 14: 26, 30: 56 }, tickets: { 7: 4, 14: 9, 30: 19 }, avg60DailyPace: 1.21 },
      { name: "Luis Ramirez", pace: { 7: 10.8, 14: 22.4, 30: 49.6 }, sp: { 7: 15, 14: 32, 30: 71 }, tickets: { 7: 5, 14: 11, 30: 24 }, avg60DailyPace: 1.55 },
    ],
  },
  {
    key: "R",
    label: "R - Code Review",
    fullLabel: "Code Review Pace",
    members: [
      { name: "Mike Del Signore", pace: { 7: 14.2, 14: 29.8, 30: 66.1 }, sp: { 7: 21, 14: 44, 30: 96 }, tickets: { 7: 7, 14: 15, 30: 32 }, avg60DailyPace: 2.05 },
      { name: "Joey Stapleton", pace: { 7: 11.6, 14: 24.3, 30: 53.8 }, sp: { 7: 17, 14: 36, 30: 78 }, tickets: { 7: 6, 14: 12, 30: 26 }, avg60DailyPace: 1.68 },
      { name: "Dylan Ameres", pace: { 7: 9.8, 14: 20.5, 30: 45.4 }, sp: { 7: 14, 14: 30, 30: 66 }, tickets: { 7: 5, 14: 10, 30: 22 }, avg60DailyPace: 1.42 },
    ],
  },
  {
    key: "I",
    label: "I - Infrastructure",
    fullLabel: "Infrastructure Improvement Pace",
    members: [
      { name: "TBD", pace: { 7: 0, 14: 0, 30: 0 }, sp: { 7: 0, 14: 0, 30: 0 }, tickets: { 7: 0, 14: 0, 30: 0 }, avg60DailyPace: 0 },
    ],
  },
  {
    key: "P",
    label: "P - PRD / Docs",
    fullLabel: "PRD Ready for Dev (Documentation) Pace",
    members: [
      { name: "Corbin Schmeil", pace: { 7: 8.4, 14: 17.6, 30: 39.2 }, sp: { 7: 12, 14: 26, 30: 57 }, tickets: { 7: 4, 14: 8, 30: 18 }, avg60DailyPace: 1.22 },
      { name: "Spencer Hayes", pace: { 7: 6.8, 14: 14.2, 30: 31.5 }, sp: { 7: 10, 14: 21, 30: 46 }, tickets: { 7: 3, 14: 7, 30: 15 }, avg60DailyPace: 0.98 },
      { name: "Sushanth Suresh Kumar", pace: { 7: 7.6, 14: 15.9, 30: 35.4 }, sp: { 7: 11, 14: 23, 30: 51 }, tickets: { 7: 4, 14: 8, 30: 16 }, avg60DailyPace: 1.10 },
      { name: "Muskan Patel", pace: { 7: 5.2, 14: 10.9, 30: 24.1 }, sp: { 7: 8, 14: 16, 30: 35 }, tickets: { 7: 2, 14: 5, 30: 11 }, avg60DailyPace: 0.75 },
    ],
  },
  {
    key: "S",
    label: "S - Support",
    fullLabel: "Support Pace",
    members: [
      { name: "TBD", pace: { 7: 0, 14: 0, 30: 0 }, sp: { 7: 0, 14: 0, 30: 0 }, tickets: { 7: 0, 14: 0, 30: 0 }, avg60DailyPace: 0 },
    ],
  },
]

export interface DevMemberPace {
  name: string
  pace: Record<number, number>
  sp: Record<number, number>
  tickets: Record<number, number>
  avg60DailyPace: number // 60-day average daily pace
}

// 2025 baseline: 200 SP pace per month per dev
export const DEV_2025_MONTHLY_BASELINE = 200

export const devTeamMembers: DevMemberPace[] = [
  { name: "Mike Del Signore", pace: { 7: 18.4, 14: 38.6, 30: 85.2 }, sp: { 7: 27, 14: 56, 30: 124 }, tickets: { 7: 9, 14: 18, 30: 40 }, avg60DailyPace: 2.65 },
  { name: "Joey Stapleton", pace: { 7: 15.6, 14: 32.8, 30: 72.4 }, sp: { 7: 23, 14: 48, 30: 105 }, tickets: { 7: 7, 14: 15, 30: 34 }, avg60DailyPace: 2.24 },
  { name: "Dylan Ameres", pace: { 7: 13.2, 14: 27.6, 30: 61.2 }, sp: { 7: 19, 14: 40, 30: 89 }, tickets: { 7: 6, 14: 13, 30: 28 }, avg60DailyPace: 1.91 },
]

// Compute TRIPS composite totals
export const tripsComposite: TripsPaceWindow = {
  day5: tripsMetrics.reduce((s, m) => s + m.pace.day5, 0),
  day10: tripsMetrics.reduce((s, m) => s + m.pace.day10, 0),
  day21_5: tripsMetrics.reduce((s, m) => s + m.pace.day21_5, 0),
  day64_5: tripsMetrics.reduce((s, m) => s + m.pace.day64_5, 0),
}

// TRIPS vs Dev ratio
export const tripsVsDevRatio: TripsPaceWindow = {
  day5: Math.round((tripsComposite.day5 / devPaceMetrics.pace.day5) * 100) / 100,
  day10: Math.round((tripsComposite.day10 / devPaceMetrics.pace.day10) * 100) / 100,
  day21_5: Math.round((tripsComposite.day21_5 / devPaceMetrics.pace.day21_5) * 100) / 100,
  day64_5: Math.round((tripsComposite.day64_5 / devPaceMetrics.pace.day64_5) * 100) / 100,
}

// ============================================================
// Client Knowledge Docs (Client.MD) Data
// ============================================================

export type KDCategory = "Core" | "Code Review" | "Testing"

export interface KnowledgeDocEntry {
  id: string
  category: KDCategory
  title: string
  content: string
  author: string
  dateAdded: string
  lastEdited: string | null
  isOfficial: boolean
}

export interface KDEditLogEntry {
  id: string
  docId: string
  docTitle: string
  editedBy: string
  editedAt: string
  changeType: "Created" | "Updated" | "Approved" | "Rejected"
  previousContent: string | null
  newContent: string
  notes: string
}

export const coreKnowledgeDocs: KnowledgeDocEntry[] = [
  { id: "KD-C001", category: "Core", title: "Database Indexing Best Practices", content: "When adding indexes to production tables, always:\n1. Test on staging with production-like data volume\n2. Add indexes during low-traffic hours\n3. Use CONCURRENTLY option for PostgreSQL to avoid locks\n4. Monitor query performance before/after", author: "Dylan Ameres", dateAdded: "02/20/26", lastEdited: null, isOfficial: true },
  { id: "KD-C002", category: "Core", title: "API Rate Limiting Standards", content: "All public API endpoints must implement rate limiting:\n- Standard endpoints: 100 req/min per API key\n- Heavy endpoints (reports, exports): 10 req/min\n- Batch endpoints: 5 req/min with max 1000 items\n- Always return X-RateLimit-* headers", author: "Mike Del Signore", dateAdded: "02/18/26", lastEdited: "02/21/26", isOfficial: true },
  { id: "KD-C003", category: "Core", title: "Error Handling Patterns", content: "Use structured error responses:\n{\n  \"error\": {\n    \"code\": \"VALIDATION_ERROR\",\n    \"message\": \"Human readable message\",\n    \"details\": [...]\n  }\n}\nNever expose stack traces in production.", author: "Joey Stapleton", dateAdded: "02/15/26", lastEdited: null, isOfficial: true },
  { id: "KD-C004", category: "Core", title: "Caching Strategy for Season Data", content: "Season data caching rules:\n- Active seasons: 5 min TTL with invalidation on update\n- Historical seasons: 1 hour TTL\n- Season stats: Real-time calculation for current, cached for past\n- Use Redis for distributed cache", author: "Anirban Khara", dateAdded: "02/22/26", lastEdited: null, isOfficial: false },
]

export const codeReviewKnowledgeDocs: KnowledgeDocEntry[] = [
  { id: "KD-CR001", category: "Code Review", title: "PR Size Guidelines", content: "Optimal PR sizes:\n- Ideal: < 200 lines changed\n- Acceptable: 200-500 lines with clear scope\n- Large: 500+ lines - must be split or have justification\n- Emergency: Bypass allowed with 2 reviewer approval", author: "Davi Chaves", dateAdded: "02/19/26", lastEdited: null, isOfficial: true },
  { id: "KD-CR002", category: "Code Review", title: "Test Coverage Requirements", content: "Minimum test coverage by component type:\n- Business logic: 80%\n- API endpoints: 70%\n- UI components: 60%\n- Utilities: 90%\n- Payment/financial code: 95%", author: "Joey Stapleton", dateAdded: "02/17/26", lastEdited: "02/20/26", isOfficial: true },
  { id: "KD-CR003", category: "Code Review", title: "Security Review Checklist", content: "Every PR must verify:\n- [ ] No hardcoded credentials/secrets\n- [ ] Input validation on all user inputs\n- [ ] SQL injection prevention (parameterized queries)\n- [ ] XSS prevention (output encoding)\n- [ ] CSRF tokens on state-changing requests", author: "Mike Del Signore", dateAdded: "02/14/26", lastEdited: null, isOfficial: true },
]

export const testingKnowledgeDocs: KnowledgeDocEntry[] = [
  { id: "KD-T001", category: "Testing", title: "QA Environment Setup", content: "Before testing any ticket:\n1. Pull latest from staging branch\n2. Clear browser cache and cookies\n3. Verify test data exists for the feature\n4. Check feature flags are correctly set\n5. Document starting state with screenshots", author: "Jordan Beebe", dateAdded: "02/21/26", lastEdited: null, isOfficial: true },
  { id: "KD-T002", category: "Testing", title: "Regression Test Priority", content: "Priority order for regression testing:\n1. Payment flows (highest risk)\n2. User authentication/authorization\n3. Data import/export\n4. Scheduling/calendar functions\n5. Notification systems\n6. Reporting features", author: "Clive Nys", dateAdded: "02/18/26", lastEdited: "02/22/26", isOfficial: true },
  { id: "KD-T003", category: "Testing", title: "Bug Report Template", content: "Required fields for bug reports:\n- Steps to reproduce (numbered)\n- Expected vs actual behavior\n- Environment (browser, device, user role)\n- Screenshots/video\n- Severity assessment\n- Related tickets if any", author: "charlson", dateAdded: "02/16/26", lastEdited: null, isOfficial: true },
  { id: "KD-T004", category: "Testing", title: "Performance Testing Thresholds", content: "Page load time limits:\n- Dashboard: < 2s\n- List views: < 1.5s\n- Detail views: < 1s\n- API calls: < 500ms (95th percentile)\n- Report generation: < 10s for standard, < 30s for large", author: "Jordan Beebe", dateAdded: "02/23/26", lastEdited: null, isOfficial: false },
]

export const kdEditLog: KDEditLogEntry[] = [
  { id: "EDIT-001", docId: "KD-C002", docTitle: "API Rate Limiting Standards", editedBy: "Dylan Ameres", editedAt: "02/21/26 10:34 AM", changeType: "Updated", previousContent: "Standard endpoints: 50 req/min", newContent: "Standard endpoints: 100 req/min per API key", notes: "Increased limits after load testing showed capacity" },
  { id: "EDIT-002", docId: "KD-CR002", docTitle: "Test Coverage Requirements", editedBy: "Davi Chaves", editedAt: "02/20/26 03:15 PM", changeType: "Updated", previousContent: "Payment/financial code: 90%", newContent: "Payment/financial code: 95%", notes: "Increased requirement after payment bug incident" },
  { id: "EDIT-003", docId: "KD-T002", docTitle: "Regression Test Priority", editedBy: "Jordan Beebe", editedAt: "02/22/26 09:00 AM", changeType: "Updated", previousContent: "1. User authentication", newContent: "1. Payment flows (highest risk)", notes: "Reordered based on recent escaped bug analysis" },
  { id: "EDIT-004", docId: "KD-C004", docTitle: "Caching Strategy for Season Data", editedBy: "Anirban Khara", editedAt: "02/22/26 02:45 PM", changeType: "Created", previousContent: null, newContent: "Season data caching rules...", notes: "Initial draft pending review" },
  { id: "EDIT-005", docId: "KD-T004", docTitle: "Performance Testing Thresholds", editedBy: "Jordan Beebe", editedAt: "02/23/26 11:20 AM", changeType: "Created", previousContent: null, newContent: "Page load time limits...", notes: "New doc based on performance issues found this sprint" },
  { id: "EDIT-006", docId: "KD-T001", docTitle: "QA Environment Setup", editedBy: "Jordan Beebe", editedAt: "02/21/26 04:30 PM", changeType: "Approved", previousContent: null, newContent: "Before testing any ticket...", notes: "Approved by QA lead" },
]
