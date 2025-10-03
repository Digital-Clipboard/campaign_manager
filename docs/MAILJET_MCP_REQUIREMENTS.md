# MailJet MCP Service - Campaign Manager Requirements

**Date**: October 3, 2025
**Requestor**: Campaign Manager System
**Target**: MailJet Agent MCP Service (`/2.growth/mailjet`)

---

## Overview

The Campaign Manager needs to retrieve historical campaign data and ongoing metrics from MailJet. This data should be accessible via MCP routes so the Campaign Manager can sync campaign status, delivery metrics, and engagement data.

---

## Required MCP Routes

### 1. **Get Campaign Statistics by ID**

**Route**: `get-campaign-stats`

**Purpose**: Fetch delivery and engagement metrics for a specific MailJet campaign

**Input Parameters**:
```typescript
{
  campaignId: number  // MailJet campaign ID
}
```

**Output**:
```typescript
{
  campaignId: number
  campaignName: string
  status: string  // "draft", "programmed", "sent", "archived"

  // Send details
  sentAt: string | null  // ISO timestamp
  scheduledAt: string | null  // ISO timestamp

  // Delivery metrics
  processed: number  // Total emails processed
  delivered: number  // Successfully delivered
  bounced: number    // Total bounces
  hardBounces: number
  softBounces: number
  blocked: number    // Blocked by recipient server
  spam: number       // Marked as spam

  // Engagement metrics
  opened: number     // Unique opens
  clicked: number    // Unique clicks
  unsubscribed: number

  // List details
  contactsList: {
    id: number
    name: string
    recipientCount: number
  }[]
}
```

**MailJet API Endpoint**:
- `GET /v3/REST/campaign/{id}`
- `GET /v3/REST/campaignstatistics/{id}`

---

### 2. **Get Campaigns by Date Range**

**Route**: `get-campaigns-by-date`

**Purpose**: Retrieve all campaigns sent within a specific date range

**Input Parameters**:
```typescript
{
  startDate: string  // ISO date: "2025-09-01"
  endDate: string    // ISO date: "2025-10-03"
  status?: string    // Optional: "sent", "programmed", "draft"
}
```

**Output**:
```typescript
{
  campaigns: [
    {
      id: number
      name: string
      status: string
      sentAt: string | null
      scheduledAt: string | null
      recipientCount: number
      listId: number
      listName: string
      subject: string
    }
  ]
  totalCount: number
}
```

**MailJet API Endpoint**:
- `GET /v3/REST/campaign?FromTS={timestamp}&ToTS={timestamp}`

---

### 3. **Get Campaign by List Name**

**Route**: `get-campaigns-by-list`

**Purpose**: Find campaigns sent to a specific contact list

**Input Parameters**:
```typescript
{
  listName: string  // e.g., "campaign_batch_001"
  limit?: number    // Optional, default 50
}
```

**Output**:
```typescript
{
  campaigns: [
    {
      id: number
      name: string
      status: string
      sentAt: string | null
      recipientCount: number
      subject: string
    }
  ]
}
```

**MailJet API Endpoint**:
- Get list ID from `GET /v3/REST/contactslist?Name={name}`
- Then `GET /v3/REST/campaign?ContactsList={listId}`

---

### 4. **Get Campaign Delivery Details**

**Route**: `get-campaign-delivery`

**Purpose**: Get detailed delivery information (bounces, blocks, etc.)

**Input Parameters**:
```typescript
{
  campaignId: number
}
```

**Output**:
```typescript
{
  campaignId: number
  totalRecipients: number

  // Delivery breakdown
  delivered: {
    count: number
    percentage: number
  }

  bounced: {
    count: number
    percentage: number
    hardBounces: number
    softBounces: number
    reasons: [
      { reason: string, count: number }
    ]
  }

  blocked: {
    count: number
    percentage: number
    reasons: [
      { reason: string, count: number }
    ]
  }

  spam: {
    count: number
    percentage: number
  }
}
```

**MailJet API Endpoint**:
- `GET /v3/REST/messagesentstatistics?Campaign={id}`

---

### 5. **Get Campaign Engagement Timeline**

**Route**: `get-campaign-engagement`

**Purpose**: Get opens and clicks over time

**Input Parameters**:
```typescript
{
  campaignId: number
  includeTimeline?: boolean  // Optional, default false
}
```

**Output**:
```typescript
{
  campaignId: number

  // Summary
  opens: {
    unique: number
    total: number
  }

  clicks: {
    unique: number
    total: number
    links: [
      {
        url: string
        clicks: number
        uniqueClicks: number
      }
    ]
  }

  unsubscribes: number

  // Timeline (if requested)
  timeline?: [
    {
      timestamp: string
      opens: number
      clicks: number
    }
  ]
}
```

**MailJet API Endpoint**:
- `GET /v3/REST/campaignstatistics/{id}`
- `GET /v3/REST/clickstatistics?Campaign={id}`
- `GET /v3/REST/openinformation?Campaign={id}`

---

## Use Cases for Campaign Manager

### Scenario 1: Sync Historical Campaign Data

**Client Letter Automation - What Actually Happened**

Campaign Manager needs to verify:
1. Were campaigns sent to lists: `campaign_batch_001`, `campaign_batch_002`, `campaign_batch_003`?
2. When were they sent?
3. How many recipients?
4. What were the delivery rates?

**MCP Calls**:
```typescript
// Step 1: Find campaigns by list names
const batch1 = await mailjet.call('get-campaigns-by-list', {
  listName: 'campaign_batch_001'
});

const batch2 = await mailjet.call('get-campaigns-by-list', {
  listName: 'campaign_batch_002'
});

const batch3 = await mailjet.call('get-campaigns-by-list', {
  listName: 'campaign_batch_003'
});

// Step 2: Get detailed stats for each
const stats1 = await mailjet.call('get-campaign-stats', {
  campaignId: batch1.campaigns[0].id
});

// Store in database: lifecycle_campaign_metrics table
```

---

### Scenario 2: Monitor Ongoing Campaigns

**Daily Sync Process**

Every 6 hours, Campaign Manager checks:
1. Any campaigns scheduled in next 24 hours?
2. Any campaigns sent in last 24 hours?
3. Update metrics for campaigns sent in last 7 days

**MCP Calls**:
```typescript
// Get recent campaigns
const yesterday = new Date(Date.now() - 24*60*60*1000);
const recent = await mailjet.call('get-campaigns-by-date', {
  startDate: yesterday.toISOString().split('T')[0],
  endDate: new Date().toISOString().split('T')[0],
  status: 'sent'
});

// Update metrics for each
for (const campaign of recent.campaigns) {
  const stats = await mailjet.call('get-campaign-stats', {
    campaignId: campaign.id
  });

  const delivery = await mailjet.call('get-campaign-delivery', {
    campaignId: campaign.id
  });

  const engagement = await mailjet.call('get-campaign-engagement', {
    campaignId: campaign.id
  });

  // Store/update in lifecycle_campaign_metrics
}
```

---

### Scenario 3: Campaign Health Check

**Detect Issues**

Campaign Manager needs to detect:
- High bounce rates (>5%)
- Low delivery rates (<95%)
- Spam complaints (>0.1%)

**MCP Calls**:
```typescript
const delivery = await mailjet.call('get-campaign-delivery', {
  campaignId: 12345
});

if (delivery.bounced.percentage > 5) {
  // Alert: High bounce rate
  // Log bounce reasons
}

if (delivery.spam.count > 0) {
  // Alert: Spam complaints
}
```

---

## Implementation Notes for MailJet Agent Developer

### Authentication
- Use existing MailJet API credentials from `.env`
- API Key: `MAILJET_API_KEY`
- Secret Key: `MAILJET_API_SECRET`

### Rate Limiting
- MailJet API has rate limits
- Implement retry logic with exponential backoff
- Cache results for 5 minutes to avoid duplicate calls

### Error Handling
- Return clear error messages for:
  - Campaign not found
  - Invalid date ranges
  - API authentication failures
  - Rate limit exceeded

### Data Validation
- Validate campaign IDs exist before fetching stats
- Validate date ranges (start < end)
- Handle null/missing data gracefully

### Testing
- Test with real campaign IDs from production
- Test with campaigns in different states (draft, sent, archived)
- Test error scenarios (invalid ID, old campaigns)

---

## Expected Timeline

**Priority**: High
**Estimated Effort**: 4-6 hours
**Dependencies**: None

**Deliverables**:
1. 5 new MCP routes in MailJet agent
2. Unit tests for each route
3. Updated MCP documentation
4. Example usage code

---

## Questions for MailJet Agent Developer

1. Should we cache campaign statistics? If so, for how long?
2. Do you need specific bounce reason codes, or is count sufficient?
3. Should engagement timeline be hourly, daily, or configurable?
4. Any MailJet API quirks we should be aware of?

---

## Campaign Manager Integration

Once MCP routes are available, Campaign Manager will:

1. **Create sync service**: `src/services/mailjet-sync.service.ts`
2. **Add cron job**: Daily sync at 00:00 UTC and 12:00 UTC
3. **Update database**: Populate `lifecycle_campaign_metrics` table
4. **Update UI**: Display real metrics in Campaign Manager dashboard

---

## Contact

For questions or clarifications, reference this document in Campaign Manager repo:
`/docs/MAILJET_MCP_REQUIREMENTS.md`
