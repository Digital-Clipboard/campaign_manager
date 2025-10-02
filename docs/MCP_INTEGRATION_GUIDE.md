# Campaign Manager - MCP Integration Guide
**Last Updated**: October 2, 2025
**Status**: Production Ready

---

## Overview

Campaign Manager provides comprehensive MCP (Model Context Protocol) integration for managing Q4 2025 marketing campaigns and lifecycle email campaigns through conversational AI interfaces.

### Available MCP Servers

1. **Lifecycle Campaign MCP Server** - Q4 2025 schedule management
2. **Campaign Orchestrator MCP** - General campaign operations
3. **MailJet Agent** - Email delivery platform integration
4. **Slack Manager** - Notification channel integration

---

## Lifecycle Campaign MCP Server

### Server Configuration

**Server Name**: `lifecycle-campaign-manager`
**Version**: 1.0.0
**Location**: `/src/integrations/mcp-clients/lifecycle-campaign-mcp-server.ts`

### Installation

```json
// Add to MCP client configuration
{
  "mcpServers": {
    "lifecycle-campaigns": {
      "command": "node",
      "args": ["dist/integrations/mcp-clients/lifecycle-campaign-mcp-server.js"],
      "env": {
        "DATABASE_URL": "postgresql://...",
        "API_BASE_URL": "https://campaign-manager-prod.herokuapp.com"
      }
    }
  }
}
```

---

## Available MCP Tools

### 1. `create_lifecycle_campaign`

Create a new 3-round lifecycle email campaign with automated scheduling.

**Use Case**: Schedule new product release campaigns with automatic weekly rounds.

**Parameters**:
```typescript
{
  campaignName: string;          // e.g., "Client Letter Automation"
  listIdPrefix: string;          // e.g., "client-letter"
  subject: string;               // Email subject with merge tags
  senderName: string;            // "Digital Clipboard"
  senderEmail: string;           // "hello@digitalclipboard.com"
  totalRecipients: number;       // Total across all 3 rounds
  mailjetListIds: number[];      // [listId1, listId2, listId3]
  mailjetTemplateId: number;     // MailJet template ID
  notificationChannel: string;   // "#_traction"
  scheduledDates?: Array<{       // Optional: custom schedule
    roundNumber: number;         // 1, 2, or 3
    date: string;                // "2025-10-15"
    time: string;                // "09:00"
  }>;
}
```

**Example**:
```json
{
  "name": "create_lifecycle_campaign",
  "arguments": {
    "campaignName": "Drawdown Income Sustainability",
    "listIdPrefix": "drawdown-q4",
    "subject": "New Feature: Automated Drawdown Planning",
    "senderName": "Digital Clipboard",
    "senderEmail": "hello@digitalclipboard.com",
    "totalRecipients": 2000,
    "mailjetListIds": [12345, 12346, 12347],
    "mailjetTemplateId": 67890,
    "notificationChannel": "#_traction"
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Campaign created with 3 scheduled rounds",
  "schedules": [
    {
      "id": 1,
      "roundNumber": 1,
      "scheduledDate": "2025-10-01T09:00:00Z",
      "status": "SCHEDULED",
      "recipientCount": 667
    },
    {
      "id": 2,
      "roundNumber": 2,
      "scheduledDate": "2025-10-08T09:00:00Z",
      "status": "SCHEDULED",
      "recipientCount": 667
    },
    {
      "id": 3,
      "roundNumber": 3,
      "scheduledDate": "2025-10-15T09:00:00Z",
      "status": "SCHEDULED",
      "recipientCount": 666
    }
  ],
  "scheduledJobs": [...]
}
```

---

### 2. `get_campaign_schedule`

Query campaign schedules with flexible filtering.

**Use Case**: Find all campaigns scheduled in a date range or by status.

**Parameters**:
```typescript
{
  campaignName?: string;    // Filter by name
  startDate?: string;       // "2025-10-01"
  endDate?: string;         // "2025-12-31"
  status?: 'SCHEDULED' | 'READY' | 'LAUNCHING' | 'SENT' | 'COMPLETED' | 'BLOCKED' | 'CANCELLED';
}
```

**Example - Get October campaigns**:
```json
{
  "name": "get_campaign_schedule",
  "arguments": {
    "startDate": "2025-10-01",
    "endDate": "2025-10-31",
    "status": "SCHEDULED"
  }
}
```

---

### 3. `get_upcoming_campaigns`

Get all campaigns scheduled in the next N days.

**Use Case**: Weekly planning - what's launching this week/month?

**Parameters**:
```typescript
{
  days?: number;              // Default: 30
  includeMetrics?: boolean;   // Default: false
}
```

**Example - Next 2 weeks**:
```json
{
  "name": "get_upcoming_campaigns",
  "arguments": {
    "days": 14,
    "includeMetrics": false
  }
}
```

**Response**:
```json
{
  "queryPeriod": "Next 14 days",
  "count": 3,
  "campaigns": [
    {
      "id": 5,
      "campaignName": "Voyant Integration",
      "roundNumber": 1,
      "scheduledDate": "2025-10-15",
      "scheduledTime": "09:00",
      "status": "SCHEDULED",
      "recipientCount": 267,
      "daysUntil": 13
    }
  ]
}
```

---

### 4. `get_weekly_schedule`

Get campaign schedule for a specific week.

**Use Case**: Weekly team stand-ups - what's launching this week?

**Parameters**:
```typescript
{
  weekOffset?: number;  // 0=this week, 1=next week, -1=last week
}
```

**Example - This week**:
```json
{
  "name": "get_weekly_schedule",
  "arguments": {
    "weekOffset": 0
  }
}
```

**Response**:
```json
{
  "week": "2025-10-01 to 2025-10-07",
  "totalCampaigns": 2,
  "schedule": {
    "2025-10-01": [
      {
        "campaignName": "Drawdown Income Sustainability",
        "roundNumber": 1,
        "time": "09:00",
        "status": "SCHEDULED",
        "recipients": 667
      }
    ],
    "2025-10-03": [
      {
        "campaignName": "Drawdown Income Sustainability",
        "roundNumber": 2,
        "time": "09:00",
        "status": "SCHEDULED",
        "recipients": 667
      }
    ]
  }
}
```

---

### 5. `get_monthly_view`

Get calendar view of all campaigns for a specific month.

**Use Case**: Monthly planning and stakeholder reporting.

**Parameters**:
```typescript
{
  month?: number;  // 1-12 (defaults to current)
  year?: number;   // defaults to current year
}
```

**Example - October 2025**:
```json
{
  "name": "get_monthly_view",
  "arguments": {
    "month": 10,
    "year": 2025
  }
}
```

---

### 6. `update_campaign_schedule`

Reschedule a campaign or update its status.

**Use Case**: Move a campaign date or manually change status.

**Parameters**:
```typescript
{
  scheduleId: number;         // Required
  scheduledDate?: string;     // "2025-11-15"
  scheduledTime?: string;     // "14:00"
  status?: 'SCHEDULED' | 'READY' | 'LAUNCHING' | 'SENT' | 'COMPLETED' | 'BLOCKED' | 'CANCELLED';
}
```

**Example - Reschedule campaign**:
```json
{
  "name": "update_campaign_schedule",
  "arguments": {
    "scheduleId": 5,
    "scheduledDate": "2025-10-20",
    "scheduledTime": "10:00"
  }
}
```

---

### 7. `get_campaign_metrics`

Retrieve delivery metrics and performance data.

**Use Case**: Post-campaign analysis and reporting.

**Parameters**:
```typescript
{
  scheduleId?: number;          // Specific round
  campaignName?: string;        // All rounds of a campaign
  includeAIAnalysis?: boolean;  // Default: false
}
```

**Example - Get all metrics for a campaign**:
```json
{
  "name": "get_campaign_metrics",
  "arguments": {
    "campaignName": "Client Letter Automation",
    "includeAIAnalysis": true
  }
}
```

**Response**:
```json
{
  "campaignName": "Client Letter Automation",
  "rounds": [
    {
      "roundNumber": 1,
      "status": "COMPLETED",
      "metrics": {
        "sent": 500,
        "delivered": 485,
        "bounced": 15,
        "opened": 320,
        "clicked": 45,
        "openRate": 65.98,
        "clickRate": 9.28
      }
    }
  ]
}
```

---

### 8. `cancel_campaign`

Cancel a scheduled campaign.

**Use Case**: Emergency cancellation or strategic changes.

**Parameters**:
```typescript
{
  scheduleId: number;        // Required
  reason: string;            // Required
  notifyChannel?: boolean;   // Default: true
}
```

**Example**:
```json
{
  "name": "cancel_campaign",
  "arguments": {
    "scheduleId": 12,
    "reason": "Business requirements changed",
    "notifyChannel": true
  }
}
```

---

### 9. `import_marketing_schedule`

Import Q4 2025 marketing schedule and create campaigns.

**Use Case**: Bulk import from communications plan.

**Parameters**:
```typescript
{
  schedule: Array<{
    name: string;
    releaseDate: string;
    theme: string;
    keyMessages: string[];
    channels: string[];
    targetAudience: string;
    successMetrics: string[];
  }>;
}
```

---

### 10. `get_slack_channel_activity`

Forecast #_traction channel activity based on scheduled campaigns.

**Use Case**: Understand when automated notifications will be posted.

**Parameters**:
```typescript
{
  days?: number;  // Days ahead to forecast (default: 14)
}
```

**Example**:
```json
{
  "name": "get_slack_channel_activity",
  "arguments": {
    "days": 30
  }
}
```

**Response**:
```json
{
  "forecastPeriod": "Next 30 days",
  "totalCampaigns": 8,
  "totalNotifications": 40,
  "channelActivity": [
    {
      "campaignName": "Drawdown Income Sustainability",
      "roundNumber": 1,
      "notifications": [
        { "type": "Pre-Launch", "time": "2025-09-30T09:00:00Z" },
        { "type": "Pre-Flight", "time": "2025-10-01T08:00:00Z" },
        { "type": "Launch Warning", "time": "2025-10-01T08:55:00Z" },
        { "type": "Launch", "time": "2025-10-01T09:00:00Z" },
        { "type": "Wrap-Up", "time": "2025-10-01T09:30:00Z" }
      ]
    }
  ]
}
```

---

## Q4 2025 Schedule Management

### Automated Import

Use the provided script to import the complete Q4 2025 schedule:

```bash
cd /path/to/campaign_manager
npm run import:q4-schedule
```

This creates:
- **8 campaigns** (from marketing schedule)
- **24 campaign rounds** (3 rounds each)
- **120 Slack notifications** (5 per round)

### Schedule Overview

| Campaign | Release Date | Rounds | Total Recipients |
|----------|-------------|--------|-----------------|
| Client Letter Automation | Sept 19 | 3 | 1,500 |
| Drawdown Income Sustainability | Oct 1 | 3 | 2,000 |
| Voyant Integration | Oct 15 | 3 | 800 |
| Management Information | Oct 29 | 3 | 1,200 |
| Client Material Tool Kit | Nov 12 | 3 | 1,500 |
| Compliance Corner | Nov 26 | 3 | 900 |
| Case Study | Dec 10 | 3 | 2,500 |
| Year in Review | Dec 17 | 3 | 3,000 |

**Total**: 13,400 recipients across 24 campaign rounds

---

## MCP Use Cases & Examples

### Use Case 1: Weekly Planning

**Goal**: See what campaigns are launching this week

```typescript
// Use get_weekly_schedule tool
const result = await mcp.useTool('get_weekly_schedule', {
  weekOffset: 0  // This week
});

// Response shows all campaigns grouped by day
// Perfect for Monday stand-ups
```

### Use Case 2: Reschedule Campaign

**Goal**: Move a campaign from Tuesday to Wednesday

```typescript
// First, find the campaign
const schedule = await mcp.useTool('get_campaign_schedule', {
  campaignName: "Voyant Integration",
  status: "SCHEDULED"
});

// Then reschedule it
await mcp.useTool('update_campaign_schedule', {
  scheduleId: schedule.schedules[0].id,
  scheduledDate: "2025-10-16"  // Move from 15th to 16th
});
```

### Use Case 3: Check #_traction Channel Load

**Goal**: See how busy #_traction will be next month

```typescript
const forecast = await mcp.useTool('get_slack_channel_activity', {
  days: 30
});

console.log(`${forecast.totalNotifications} notifications in next 30 days`);
// Shows: 40 notifications (8 campaigns × 5 messages each)
```

### Use Case 4: Post-Campaign Analysis

**Goal**: Review performance after all 3 rounds complete

```typescript
const metrics = await mcp.useTool('get_campaign_metrics', {
  campaignName: "Client Letter Automation",
  includeAIAnalysis: true
});

// Get aggregated metrics across all 3 rounds
// Plus AI-powered recommendations
```

### Use Case 5: Create New Campaign

**Goal**: Add an unplanned campaign to the schedule

```typescript
await mcp.useTool('create_lifecycle_campaign', {
  campaignName: "Emergency Product Update",
  listIdPrefix: "emergency-oct",
  subject: "Important Platform Update",
  senderName: "Digital Clipboard",
  senderEmail: "hello@digitalclipboard.com",
  totalRecipients: 1000,
  mailjetListIds: [11111, 22222, 33333],
  mailjetTemplateId: 99999,
  notificationChannel: "#_traction",
  scheduledDates: [
    { roundNumber: 1, date: "2025-10-20", time: "14:00" },
    { roundNumber: 2, date: "2025-10-27", time: "14:00" },
    { roundNumber: 3, date: "2025-11-03", time: "14:00" }
  ]
});
```

---

## Integration with Claude/AI Assistants

### Example Prompts

**Check upcoming schedule**:
> "What campaigns are launching in the next 2 weeks?"

**Create new campaign**:
> "Create a 3-round campaign for the Voyant Integration release on October 15th. Send to 800 recipients using MailJet lists 12345, 12346, 12347 with template 67890. Post notifications to #_traction."

**Get weekly view**:
> "Show me this week's campaign schedule"

**Forecast channel activity**:
> "How many Slack notifications will #_traction receive in the next month?"

**Reschedule campaign**:
> "Move the Management Information campaign from October 29th to November 5th"

---

## API vs MCP Comparison

| Feature | HTTP API | MCP Tools |
|---------|---------|-----------|
| **Access** | Direct HTTP calls | Conversational AI interface |
| **Auth** | API keys/tokens | MCP session |
| **Format** | JSON request/response | Natural language → structured calls |
| **Visibility** | Developer-focused | Business user-friendly |
| **Batch Ops** | Manual scripting | AI-assisted multi-tool workflows |
| **Discovery** | API docs | Tool descriptions in conversation |

**When to use HTTP API**:
- Programmatic integrations
- Webhook callbacks
- Direct system-to-system communication

**When to use MCP**:
- Ad-hoc queries during planning meetings
- Executive reporting
- Strategic decision-making
- Natural language campaign management

---

## Best Practices

### 1. Always Check Schedule Before Creating

```typescript
// Check for conflicts
const existing = await mcp.useTool('get_campaign_schedule', {
  startDate: "2025-10-15",
  endDate: "2025-10-15"
});

if (existing.count > 0) {
  console.log('Warning: Campaign already scheduled on this date');
}
```

### 2. Use Weekly View for Team Meetings

```typescript
// Monday stand-up routine
const thisWeek = await mcp.useTool('get_weekly_schedule', { weekOffset: 0 });
const nextWeek = await mcp.useTool('get_weekly_schedule', { weekOffset: 1 });

// Review both weeks with team
```

### 3. Monitor Slack Channel Load

```typescript
// Before scheduling new campaign
const activity = await mcp.useTool('get_slack_channel_activity', { days: 7 });

// Ensure we're not overwhelming the channel
// Ideal: Max 2-3 campaigns per week
```

### 4. Track Metrics Regularly

```typescript
// Weekly metrics review
const campaigns = await mcp.useTool('get_campaign_schedule', {
  status: 'SENT',
  startDate: '2025-09-01',
  endDate: '2025-09-30'
});

// Get metrics for each
for (const campaign of campaigns.schedules) {
  const metrics = await mcp.useTool('get_campaign_metrics', {
    scheduleId: campaign.id
  });
  // Analyze performance
}
```

---

## Troubleshooting

### Tool Not Found

**Error**: "Unknown tool: get_campaign_schedule"

**Solution**:
1. Verify MCP server is running
2. Check server configuration in MCP client
3. Restart MCP session

### Invalid Parameters

**Error**: "Validation error: mailjetListIds must be array of 3"

**Solution**: Ensure all required parameters match schema
```typescript
// ❌ Wrong
mailjetListIds: [12345, 12346]  // Only 2 lists

// ✅ Correct
mailjetListIds: [12345, 12346, 12347]  // 3 lists
```

### Database Connection

**Error**: "Cannot connect to database"

**Solution**: Check `DATABASE_URL` environment variable in MCP config

---

## Future Enhancements

### Planned Features

- [ ] A/B test campaign variants
- [ ] Multi-channel campaigns (Email + SMS + Push)
- [ ] Advanced segmentation tools
- [ ] Real-time delivery monitoring dashboard
- [ ] Automated campaign optimization (AI-powered)
- [ ] Integration with more email platforms

### MCP Tool Additions

- `create_ab_test` - Set up A/B test campaigns
- `get_segment_analysis` - Analyze recipient segments
- `optimize_send_time` - AI-recommended send times
- `get_comparative_metrics` - Compare campaign performance
- `export_report` - Generate PDF/CSV reports

---

## Support & Documentation

**Full API Docs**: [docs/CAMPAIGN_MANAGER_STATUS.md](./CAMPAIGN_MANAGER_STATUS.md)

**MCP Protocol**: https://modelcontextprotocol.io/

**Issues**: GitHub Issues or #campaign-manager Slack channel

**Contact**: brian@digitalclipboard.com
