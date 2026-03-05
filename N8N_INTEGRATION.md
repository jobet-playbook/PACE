# n8n Integration Guide for QA Metrics

## Overview
This guide explains how to send QA metrics data from n8n to your Next.js application. The data is **cached in memory** (not saved to database) and refreshes daily via your n8n workflow.

---

## API Endpoint

**URL**: `http://localhost:3000/api/qa-metrics` (or your production URL)

**Method**: `POST`

**Content-Type**: `application/json`

---

## n8n HTTP Request Node Configuration

### 1. Add HTTP Request Node

In your n8n workflow, add an **HTTP Request** node with the following settings:

### 2. Node Settings

**Authentication**: None (or add API key authentication if needed)

**Request Method**: `POST`

**URL**: `http://localhost:3000/api/qa-metrics`

**Send Body**: Yes

**Body Content Type**: `JSON`

**Specify Body**: Using JSON

**JSON Body**: Use the expression editor to pass your data

---

## Data Format

The endpoint expects an array with your QA metrics data. Here's the structure:

```json
[
  {
    "output": {
      "report_meta": {
        "generated_at_et": "03/03/26",
        "report_type": "Daily QA Performance Report",
        "today_label": "03/03/26",
        "last_business_day_label": "03/02/26"
      },
      "today_overview": {
        "total_tickets": 6,
        "total_story_points": 52,
        "repeat_percentage": 16.67,
        "first_time": {
          "ticket_count": 5,
          "story_points": 44
        },
        "repeat_pass": {
          "ticket_count": 1,
          "story_points": 8
        }
      },
      "last_business_day_overview": {
        "total_tickets": 10,
        "total_story_points": 14,
        "repeat_percentage": 30,
        "first_time": {
          "ticket_count": 7,
          "story_points": 9
        },
        "repeat_pass": {
          "ticket_count": 3,
          "story_points": 5
        }
      },
      "people": [
        {
          "qa_assignee": "charlson",
          "today_stats": {
            "ticket_count": 2,
            "story_points": 9,
            "first_time_count": 1,
            "repeat_count": 1,
            "repeat_percentage": 50
          },
          "last_business_day_stats": {
            "ticket_count": 8,
            "story_points": 11,
            "first_time_count": 6,
            "repeat_count": 2,
            "repeat_percentage": 25
          },
          "today_tickets": [...],
          "last_business_day_tickets": [...],
          "personName": "charlson",
          "activitySummary": {
            "totalActions": 2,
            "firstActionTime": "10:46:08 AM",
            "lastActionTime": "11:22:16 AM",
            "summaryText": "Processed 2 tickets."
          },
          "timeAnalysis": {
            "gaps": [...],
            "totalInactiveMinutes": 36.13,
            "analysisText": "Identified 1 significant gap(s) totaling 36.13 minutes."
          }
        }
      ],
      "date": "03/03/26"
    },
    "last_30_business_days": {...},
    "critical_qa_wip_tickets": [...],
    "old_qa_wip_tickets": [...]
  },
  {
    "kind": "drive#file",
    "id": "1N-HpzVLeuapS9YXwTG-6NY4sk2OaSaKLCRy2F4bADzQ",
    "name": "QA Daily Metric Breakdown — 3/4/2026",
    "mimeType": "application/vnd.google-apps.document"
  }
]
```

---

## n8n Workflow Example

### Step 1: Get Your QA Data
Use whatever nodes you need to fetch/generate your QA metrics data.

### Step 2: HTTP Request Node
Configure the HTTP Request node:

```javascript
// In the JSON Body field, use your data variable
// For example, if your data is in $json:
{{ $json }}

// Or if you need to structure it:
[
  {{ $json }},
  {
    "kind": "drive#file",
    "id": "{{ $json.googleDocId }}",
    "name": "{{ $json.googleDocName }}",
    "mimeType": "application/vnd.google-apps.document"
  }
]
```

### Step 3: Headers (Optional)
Add headers if needed:
- `Content-Type`: `application/json` (usually auto-set)
- `Authorization`: `Bearer YOUR_API_KEY` (if you add authentication)

---

## Response Format

### Success Response (200)
```json
{
  "success": true,
  "message": "QA metrics data cached successfully",
  "reportDate": "03/03/26",
  "reportType": "Daily QA Performance Report",
  "assigneeCount": 4,
  "criticalTicketsCount": 0,
  "oldTicketsCount": 7,
  "cachedAt": "2026-03-05T12:00:00.000Z"
}
```

### Error Response (400/500)
```json
{
  "error": "Failed to process QA metrics data",
  "details": "Error message here"
}
```

---

## Retrieving Cached Data

### Get Current Cached Data
**GET** `/api/qa-metrics`

Returns the currently cached QA metrics (refreshed daily by n8n).

### Response
```json
{
  "success": true,
  "data": {
    "output": { /* full QA metrics data */ },
    "last_30_business_days": { /* 30-day data */ },
    "critical_qa_wip_tickets": [ /* critical tickets */ ],
    "old_qa_wip_tickets": [ /* old tickets */ ],
    "receivedAt": "2026-03-05T12:00:00.000Z"
  },
  "cacheInfo": {
    "cachedAt": "2026-03-05T12:00:00.000Z",
    "ageMinutes": 45,
    "ageHours": 0
  }
}
```

### Dashboard-Formatted Data
**GET** `/api/dashboard/qa-live`

Returns QA metrics formatted for the dashboard UI (same structure as `/api/dashboard/qa`).

---

## Testing

### Using cURL
```bash
curl -X POST http://localhost:3000/api/qa-metrics \
  -H "Content-Type: application/json" \
  -d @qa-metrics-sample.json
```

### Using Postman
1. Create a new POST request
2. URL: `http://localhost:3000/api/qa-metrics`
3. Headers: `Content-Type: application/json`
4. Body: Raw JSON with your data
5. Send

### Using n8n Webhook Test
1. Add a Webhook node before your HTTP Request
2. Trigger it with sample data
3. Check the HTTP Request node output

---

## Error Handling in n8n

Add an **IF** node after the HTTP Request to handle errors:

```javascript
// Condition: {{ $json.success }} equals true

// On Success branch:
// - Log success
// - Continue workflow

// On Error branch:
// - Send notification
// - Log error
// - Retry or stop
```

---

## Production Deployment

### 1. Update URL
Change the URL from `localhost:3000` to your production domain:
```
https://your-domain.com/api/qa-metrics
```

### 2. Add Authentication (Recommended)
Update the endpoint to require an API key:

```typescript
// In app/api/qa-metrics/route.ts
const apiKey = request.headers.get('x-api-key')
if (apiKey !== process.env.QA_METRICS_API_KEY) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

Then in n8n, add header:
- **Name**: `x-api-key`
- **Value**: `YOUR_SECRET_API_KEY`

### 3. Set Environment Variable
In your production environment:
```env
QA_METRICS_API_KEY=your-secret-key-here
```

---

## How It Works

### Cache Behavior
- Data is stored **in-memory** (RAM) on the Next.js server
- Cache persists until server restart or new data arrives
- No database storage - perfect for daily refreshing data
- Lightweight and fast

### Daily Workflow
1. n8n workflow triggers daily (e.g., 8 AM)
2. Sends QA metrics to `/api/qa-metrics` (POST)
3. Data is cached in memory
4. Dashboard fetches from `/api/dashboard/qa-live` (GET)
5. Users see live data on the website

### Server Restart
If the server restarts before n8n sends new data:
- Cache is empty
- Dashboard shows "No live data available yet"
- Next n8n trigger will populate cache again

---

## Troubleshooting

### "Invalid data format" error
- Ensure your data is an array
- Check that the first element has an `output` property

### "Missing output data" error
- Verify the `output` object exists in your payload
- Check the data structure matches the expected format

### Database errors
- Run `npm run db:generate` to update Prisma client
- Run `npm run db:push` to update database schema

### Connection timeout
- Check your Next.js server is running
- Verify the URL is correct
- Check firewall settings

---

## Support

For issues or questions:
1. Check the API response for error details
2. Review the server logs: `npm run dev`
3. Test with Postman first before n8n
4. Verify database schema is up to date
