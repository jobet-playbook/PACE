# API Documentation

## Base URL
```
http://localhost:3000/api
```

---

## Endpoints

### Health Check

**GET** `/api/health`

Check API and database health.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-03-05T12:41:00.000Z",
  "database": "connected"
}
```

---

### Dashboard Data

#### Get QA Dashboard
**GET** `/api/dashboard/qa`

Returns complete QA dashboard data.

**Response:**
```json
{
  "metrics": { ... },
  "criticalTickets": [ ... ],
  "agingTickets": [ ... ],
  "dailyPerformance": { ... },
  "teamMembers": [ ... ],
  "allMembers": [ ... ],
  "allStatuses": [ ... ],
  "aiInsights": [ ... ],
  "escapedBugs": [ ... ]
}
```

#### Get Documentation Dashboard
**GET** `/api/dashboard/documentation`

Returns complete documentation dashboard data.

#### Get Code Review Dashboard
**GET** `/api/dashboard/code-review`

Returns complete code review dashboard data.

---

### Chart Data

**GET** `/api/chart/[dashboardType]?member=[memberName]`

Get time-series chart data.

**Parameters:**
- `dashboardType` (path): `qa`, `documentation`, or `code-review`
- `member` (query, optional): Team member name or `all`

**Example:**
```
GET /api/chart/qa?member=Clive%20Nys
```

**Response:**
```json
[
  {
    "date": "2026-02-01T00:00:00.000Z",
    "label": "02/01",
    "spThroughput": 95,
    "pace": 48.5,
    "cycleTime": 6.2,
    "volume": 27,
    "returnRate": 35
  },
  ...
]
```

---

### Tickets

#### List Tickets
**GET** `/api/tickets?dashboardType=[type]&ticketType=[type]&assignee=[name]`

**Query Parameters:**
- `dashboardType` (optional): Filter by dashboard
- `ticketType` (optional): `critical` or `aging`
- `assignee` (optional): Filter by assignee

**Response:**
```json
[
  {
    "id": "clxxx...",
    "key": "PBSCR-9894",
    "recentAge": 3,
    "age": 7,
    "sp": 8,
    "assignee": "Jordan Beebe",
    "developer": "Joey Stapleton",
    "returnCount": 3,
    "firstQA": "02/13/26",
    "latestQA": "02/19/26",
    "status": "QA",
    "summary": "...",
    "dashboardType": "qa",
    "ticketType": "critical",
    "createdAt": "2026-03-05T12:00:00.000Z",
    "updatedAt": "2026-03-05T12:00:00.000Z"
  }
]
```

#### Create Ticket
**POST** `/api/tickets`

**Body:**
```json
{
  "key": "PBSCR-1234",
  "recentAge": 1,
  "age": 1,
  "sp": 5,
  "assignee": "John Doe",
  "developer": "Jane Smith",
  "returnCount": 0,
  "firstQA": "03/05/26",
  "latestQA": "03/05/26",
  "status": "QA",
  "summary": "Ticket summary",
  "dashboardType": "qa",
  "ticketType": "critical"
}
```

#### Get Single Ticket
**GET** `/api/tickets/[id]`

#### Update Ticket
**PATCH** `/api/tickets/[id]`

**Body:**
```json
{
  "status": "Done",
  "returnCount": 1
}
```

#### Delete Ticket
**DELETE** `/api/tickets/[id]`

---

### Team Members

#### List Team Members
**GET** `/api/team-members?dashboardType=[type]`

**Query Parameters:**
- `dashboardType` (optional): Filter by dashboard

**Response:**
```json
[
  {
    "id": "clxxx...",
    "name": "Clive Nys",
    "dashboardType": "qa",
    "todayTickets": 4,
    "todaySP": 9,
    "todayFirstPass": 2,
    "todayFirstPassSP": 3,
    "todayRepeatPass": 2,
    "todayRepeatPassSP": 6,
    "todayChurn": 50,
    "weeklyTickets": 18,
    "weeklySP": 42,
    "weeklyFirstPass": 10,
    "weeklyRepeatPass": 8,
    "weeklyAvgCycleTime": 5.4,
    "monthlyTickets": 72,
    "monthlySP": 168,
    "monthlyFirstPass": 41,
    "monthlyRepeatPass": 31,
    "monthlyAvgCycleTime": 5.8,
    "dailyRhythm": "...",
    "activities": [ ... ],
    "createdAt": "2026-03-05T12:00:00.000Z",
    "updatedAt": "2026-03-05T12:00:00.000Z"
  }
]
```

#### Create Team Member
**POST** `/api/team-members`

**Body:**
```json
{
  "name": "New Member",
  "dashboardType": "qa",
  "todayTickets": 0,
  "todaySP": 0,
  "dailyRhythm": ""
}
```

---

## Server Actions

Server actions are available for mutations from React Server Components.

### Ticket Actions
```typescript
import { updateTicketStatus, deleteTicket, createTicket } from '@/app/actions/tickets'

// Update ticket status
await updateTicketStatus(ticketId, 'Done')

// Delete ticket
await deleteTicket(ticketId)

// Create ticket
await createTicket({ ... })
```

### Team Member Actions
```typescript
import { updateTeamMemberPerformance, addActivity } from '@/app/actions/team-members'

// Update performance
await updateTeamMemberPerformance(memberId, {
  todayTickets: 5,
  todaySP: 12
})

// Add activity
await addActivity(memberId, {
  ticketKey: 'PBSCR-1234',
  sp: 5,
  type: 'First Pass',
  time: '2:30 PM',
  description: 'Completed testing'
})
```

---

## Error Responses

All endpoints return standard error responses:

**400 Bad Request:**
```json
{
  "error": "Invalid request parameters"
}
```

**404 Not Found:**
```json
{
  "error": "Resource not found"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal server error"
}
```

---

## Rate Limiting

Currently no rate limiting is implemented. For production:
- Implement rate limiting middleware
- Use Vercel's built-in rate limiting
- Add API key authentication

---

## CORS

CORS is enabled for all API routes via middleware. Customize in `middleware.ts`.

---

## Authentication

No authentication is currently implemented. To add:

### Option 1: NextAuth.js
```bash
npm install next-auth
```

### Option 2: Clerk
```bash
npm install @clerk/nextjs
```

### Option 3: Custom JWT
Implement JWT middleware in `middleware.ts`
