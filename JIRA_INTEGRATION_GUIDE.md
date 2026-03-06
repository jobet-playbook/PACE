# Jira Integration Guide

## Overview

This guide explains how to use the internal Jira integration instead of n8n for QA metrics processing.

The internal workflow replicates all n8n logic in TypeScript, fetching tickets directly from Jira and processing them server-side.

---

## 🏗️ Architecture

### **Old Flow (n8n):**
```
Jira → n8n Workflow → Webhook → Supabase
```

### **New Flow (Internal):**
```
Jira API → TypeScript Workflow → Supabase
```

---

## 📋 Setup Steps

### 1. **Get Jira API Credentials**

You need:
- **Jira Base URL**: `https://callplaybook.atlassian.net`
- **Email**: Your Atlassian account email
- **API Token**: Generate from [Atlassian API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens)

### 2. **Add Environment Variables**

Add to `.env.local`:

```env
# Jira API Configuration
JIRA_BASE_URL=https://callplaybook.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your_api_token_here

# Supabase Service Role Key (for writes)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional: Cron secret for scheduled jobs
CRON_SECRET=your_random_secret_here
```

### 3. **Install Dependencies**

The Jira client uses native `fetch`, so no additional dependencies are needed.

---

## 🚀 Usage

### **Option 1: Manual Trigger (API Endpoint)**

Trigger the sync manually:

```bash
curl -X POST https://your-app.vercel.app/api/qa-metrics/sync \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Or using the browser/Postman:
```
POST /api/qa-metrics/sync
```

### **Option 2: Scheduled Cron Job (Vercel)**

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/qa-metrics/sync",
      "schedule": "0 9 * * 1-5"
    }
  ]
}
```

This runs every weekday at 9 AM UTC.

### **Option 3: GitHub Actions**

Create `.github/workflows/sync-qa-metrics.yml`:

```yaml
name: Sync QA Metrics

on:
  schedule:
    - cron: '0 9 * * 1-5'  # Weekdays at 9 AM UTC
  workflow_dispatch:  # Manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Sync
        run: |
          curl -X POST ${{ secrets.APP_URL }}/api/qa-metrics/sync \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

---

## 📊 What Gets Processed

The workflow fetches and processes:

### **1. Rollback Windows**
- Last 7 Days (`w7`)
- Last 28 Days (`w28`)
- Prior 7 Days (`prior_w7`)
- Prior 28 Days (`prior_w28`)

### **2. Ticket Types**
- ✅ **Done Tickets**: Completed in QA
- 🔄 **WIP Tickets**: Currently in QA
- 🐞 **Defect Tickets**: Escaped defects
- ⏮️ **Pushback Tickets**: Returned to development

### **3. Calculated Metrics**
- **Cycle Time**: Time from creation → QA → Done
- **Throughput**: Story points completed per QA member
- **WIP Analysis**: Current workload and aging tickets
- **Defect Tracking**: Critical bugs and escaped defects

---

## 🔍 Monitoring

### **Check Last Sync**

```bash
curl https://your-app.vercel.app/api/qa-metrics/sync
```

Response:
```json
{
  "lastSync": "2026-03-06T12:00:00Z",
  "message": "Last sync completed successfully"
}
```

### **View Logs**

In Vercel Dashboard:
1. Go to your project
2. Click "Logs"
3. Filter by `/api/qa-metrics/sync`

Look for:
- `📊 Processing rollback window: Last 7 Days`
- `✓ Done: 45, WIP: 12, Defects: 3, Pushback: 8`
- `✅ Metrics stored successfully`

---

## 🗂️ File Structure

```
lib/
├── jira-client.ts          # Jira API client
└── jira-workflow.ts        # Workflow processing logic

app/api/
├── qa-metrics/
│   └── sync/
│       └── route.ts        # Sync endpoint
└── qa-metrics-v2/
    └── route.ts            # Normalized data ingestion
```

---

## 🔧 Customization

### **Change Projects**

Edit `lib/jira-workflow.ts`:

```typescript
const projects = ['Your Project 1', 'Your Project 2']
```

### **Change QA Status**

Edit `lib/jira-workflow.ts`:

```typescript
const COUNTED_STATUS = ['Quality Assurance', 'QA Review']
```

### **Adjust Time Windows**

Edit `lib/jira-workflow.ts`:

```typescript
const ROLLBACK_WINDOWS: RollbackWindow[] = [
  { title: 'Last 14 Days', key: 'w14', days: 14, prior_days: 0 },
  // Add more windows...
]
```

---

## 🆚 Comparison: n8n vs Internal

| Feature | n8n Workflow | Internal Workflow |
|---------|-------------|-------------------|
| **Setup** | Complex, external service | Simple, in-codebase |
| **Maintenance** | UI-based, harder to version | Code-based, Git versioned |
| **Debugging** | Limited logs | Full TypeScript debugging |
| **Cost** | n8n hosting fees | Free (runs on Vercel) |
| **Customization** | Drag-and-drop nodes | TypeScript code |
| **Performance** | Network overhead | Direct API calls |
| **Reliability** | Depends on n8n uptime | Runs on your infrastructure |

---

## 🐛 Troubleshooting

### **Error: "Missing Jira configuration"**

**Solution:** Add `JIRA_BASE_URL`, `JIRA_EMAIL`, and `JIRA_API_TOKEN` to `.env.local`

### **Error: "Jira API error: 401"**

**Solution:** 
1. Verify your API token is correct
2. Check that email matches your Atlassian account
3. Regenerate API token if needed

### **Error: "Jira API error: 403"**

**Solution:** Your account doesn't have permission to access the projects. Contact your Jira admin.

### **No tickets found**

**Solution:**
1. Check JQL queries in `jira-workflow.ts`
2. Verify project names match exactly
3. Ensure tickets exist in the time windows

### **Timeout errors**

**Solution:**
1. Reduce batch size in `batchGetIssuesWithChangelog`
2. Increase Vercel function timeout (Pro plan)
3. Process windows sequentially instead of parallel

---

## 📈 Performance

### **Typical Execution Time**

- **Small project** (< 100 tickets): ~10-15 seconds
- **Medium project** (100-500 tickets): ~30-60 seconds
- **Large project** (> 500 tickets): ~2-5 minutes

### **API Rate Limits**

Jira Cloud rate limits:
- **Standard**: 10 requests/second
- **Premium**: 100 requests/second

The workflow includes:
- Batch processing (50 tickets at a time)
- Small delays between batches (100ms)
- Automatic retry logic (TODO)

---

## 🔐 Security

### **API Token Storage**

✅ **DO:**
- Store in environment variables
- Use Vercel/GitHub secrets
- Rotate tokens regularly

❌ **DON'T:**
- Commit tokens to Git
- Share tokens in Slack/email
- Use personal tokens for production

### **Endpoint Protection**

The sync endpoint supports authorization:

```typescript
// In route.ts
const authHeader = request.headers.get('authorization')
const expectedToken = process.env.CRON_SECRET

if (authHeader !== `Bearer ${expectedToken}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

---

## 🚀 Migration from n8n

### **Step 1: Test Internal Workflow**

```bash
# Trigger manually
curl -X POST http://localhost:3000/api/qa-metrics/sync
```

### **Step 2: Compare Results**

Run both n8n and internal workflows, compare:
- Ticket counts
- Story point totals
- Cycle time metrics

### **Step 3: Switch Over**

1. Disable n8n workflow
2. Enable Vercel cron job
3. Monitor for 1 week

### **Step 4: Cleanup**

1. Delete n8n workflow
2. Remove n8n webhook endpoint
3. Archive n8n documentation

---

## 📝 Next Steps

1. ✅ Set up Jira API credentials
2. ✅ Add environment variables
3. ✅ Test sync endpoint locally
4. ✅ Deploy to Vercel
5. ✅ Set up cron job
6. ✅ Monitor first few runs
7. ✅ Migrate from n8n

---

## 🆘 Support

**Issues?**
- Check Vercel logs
- Review Jira API docs: https://developer.atlassian.com/cloud/jira/platform/rest/v3/
- File GitHub issue with logs

**Questions?**
- Review code comments in `lib/jira-workflow.ts`
- Check n8n workflow for original logic
- Consult Jira JQL documentation
