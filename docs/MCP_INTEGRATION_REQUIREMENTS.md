# Campaign Manager MCP Integration Requirements

## Overview
This document specifies the Model Context Protocol (MCP) integration requirements for the Campaign Manager system to interface with external services including Mailjet (email) and Slack Manager (team communication).

## Current MCP Services Available

### 1. Mailjet MCP Server
- **Production URL**: https://mailjet-agent-prod-d874b6b38888.herokuapp.com
- **Staging URL**: https://mailjet-agent-staging-25ce4b40b638.herokuapp.com
- **Authentication**: JWT tokens with 24-hour expiry

#### Available Endpoints:
1. **Campaign Management**
   - `POST /mailjet/campaigns/list` - List all campaigns with filtering
   - `POST /mailjet/campaigns/search` - Search campaigns by criteria
   - `POST /mailjet/campaigns/find_by_subject` - Find campaign by subject
   - `POST /mailjet/campaigns/statistics` - Get campaign statistics

2. **Template Management**
   - `POST /mailjet/templates/list` - List email templates
   - `POST /mailjet/templates/get` - Get template details
   - `POST /mailjet/templates/create` - Create new template
   - `POST /mailjet/templates/update` - Update template

3. **Email Sending**
   - `POST /mailjet/send` - Send transactional email
   - `POST /mailjet/send_bulk` - Send bulk emails

4. **Contact Management**
   - `POST /mailjet/contacts/list` - List contacts
   - `POST /mailjet/contacts/create` - Create contact
   - `POST /mailjet/contacts/update` - Update contact

### 2. Slack Manager MCP Server
- **Architecture**: Hexagonal Architecture with Redis caching
- **Authentication**: OAuth or Bot tokens
- **Caching**: Redis-based with 90% API call reduction

#### Available Services:
1. **Channel Management**
   - Get channel ID by name
   - Get channel information
   - Create channels (public/private)
   - Archive channels
   - List channel members

2. **User Operations**
   - Get user ID by username
   - Get user information
   - List workspace members
   - Get user groups

3. **Messaging**
   - Send messages to channels
   - Send direct messages
   - Update messages
   - Add reactions

4. **Meeting Notes** (if configured)
   - Create meeting notes
   - Search meeting notes
   - Update meeting notes

## Required MCP Integrations for Campaign Manager

### Phase 1: Core Email Integration (Mailjet)

#### 1.1 Campaign Statistics Sync
```typescript
interface MailjetCampaignStats {
  campaignId: string;
  subject: string;
  status: 'draft' | 'sent' | 'archived';
  sentAt?: Date;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  bouncedCount: number;
  spamCount: number;
  unsubscribedCount: number;
  openRate: number;
  clickRate: number;
}
```

**Requirements:**
- Sync campaign statistics every 30 minutes for active campaigns
- Store historical data for analytics
- Map Mailjet campaign IDs to internal campaign IDs
- Calculate engagement scores

#### 1.2 Template Management
```typescript
interface MailjetTemplateSync {
  templateId: string;
  name: string;
  category: string;
  variables: string[];
  lastUsed?: Date;
  performanceScore?: number;
}
```

**Requirements:**
- Import Mailjet templates into campaign manager
- Map template variables to campaign data
- Track template performance
- Enable template selection during campaign creation

#### 1.3 Email Sending Integration
```typescript
interface CampaignEmailRequest {
  campaignId: string;
  templateId: string;
  recipients: Array<{
    email: string;
    name: string;
    variables: Record<string, any>;
  }>;
  scheduledAt?: Date;
  testMode?: boolean;
}
```

**Requirements:**
- Queue emails through Mailjet MCP
- Handle batch sending for large lists
- Track send status per recipient
- Implement retry logic for failures

### Phase 2: Team Communication Integration (Slack)

#### 2.1 Campaign Notifications
```typescript
interface SlackCampaignNotification {
  type: 'status_change' | 'approval_needed' | 'task_assigned' | 'milestone_reached';
  campaignId: string;
  campaignName: string;
  channelId?: string;
  userId?: string;
  message: string;
  attachments?: Array<{
    title: string;
    value: string;
    color?: string;
  }>;
  actions?: Array<{
    type: 'button';
    text: string;
    url: string;
  }>;
}
```

**Requirements:**
- Send notifications to designated campaign channels
- Direct message task assignees
- Post approval requests with action buttons
- Update campaign status in Slack

#### 2.2 Approval Workflows
```typescript
interface SlackApprovalRequest {
  approvalId: string;
  campaignId: string;
  stage: string;
  approverId: string;
  slackUserId?: string;
  deadline: Date;
  actions: {
    approve: string;
    reject: string;
    requestChanges: string;
  };
}
```

**Requirements:**
- Create interactive approval messages
- Handle approval responses from Slack
- Update approval status in real-time
- Send reminders for pending approvals

#### 2.3 Team Coordination
```typescript
interface SlackTeamSync {
  workspaceId: string;
  teamMembers: Array<{
    slackUserId: string;
    email: string;
    name: string;
    isActive: boolean;
  }>;
  channels: Array<{
    channelId: string;
    channelName: string;
    purpose: string;
    memberCount: number;
  }>;
}
```

**Requirements:**
- Sync Slack users with team members
- Map Slack channels to campaigns
- Track user availability from Slack status
- Coordinate task discussions in threads

### Phase 3: Dashboard Analytics Integration

#### 3.1 Email Performance Metrics
```typescript
interface EmailPerformanceMetrics {
  campaignId: string;
  period: 'daily' | 'weekly' | 'monthly';
  metrics: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
    revenue?: number;
  };
  trends: {
    openRateTrend: number; // percentage change
    clickRateTrend: number;
    engagementScore: number;
  };
}
```

**Requirements:**
- Aggregate email metrics from Mailjet
- Calculate period-over-period trends
- Generate performance scores
- Identify top-performing content

#### 3.2 Team Activity Metrics
```typescript
interface TeamActivityMetrics {
  period: 'daily' | 'weekly' | 'monthly';
  metrics: {
    messagesPosted: number;
    approvalsProcessed: number;
    averageResponseTime: number;
    activeUsers: number;
    taskDiscussions: number;
  };
  topContributors: Array<{
    userId: string;
    name: string;
    activityScore: number;
  }>;
}
```

**Requirements:**
- Track Slack activity per campaign
- Measure team responsiveness
- Identify bottlenecks in communication
- Generate engagement reports

## Implementation Strategy

### 1. MCP Client Service
Create a centralized MCP client service to manage all external integrations:

```typescript
// src/services/mcp/mcp-client.service.ts
export class MCPClientService {
  private mailjetClient: MailjetMCPClient;
  private slackClient: SlackMCPClient;

  async syncCampaignStatistics(campaignId: string): Promise<void>;
  async sendCampaignEmails(request: CampaignEmailRequest): Promise<void>;
  async postSlackNotification(notification: SlackCampaignNotification): Promise<void>;
  async createSlackApproval(approval: SlackApprovalRequest): Promise<void>;
}
```

### 2. Authentication Management
```typescript
// src/services/mcp/auth.service.ts
export class MCPAuthService {
  generateMailjetToken(): string;
  validateSlackOAuth(code: string): Promise<SlackTokens>;
  refreshTokens(): Promise<void>;
}
```

### 3. Webhook Handlers
```typescript
// src/api/webhooks/mcp.webhooks.ts
export class MCPWebhookHandler {
  handleMailjetEvent(event: MailjetWebhookEvent): Promise<void>;
  handleSlackInteraction(interaction: SlackInteractionPayload): Promise<void>;
  handleSlackEvent(event: SlackEventPayload): Promise<void>;
}
```

### 4. Background Jobs
```typescript
// src/jobs/mcp.jobs.ts
export const mcpJobs = {
  syncMailjetStats: 'sync-mailjet-stats',      // Every 30 minutes
  syncSlackUsers: 'sync-slack-users',          // Every hour
  processEmailQueue: 'process-email-queue',     // Every 5 minutes
  updateSlackChannels: 'update-slack-channels'  // Every 6 hours
};
```

## Configuration Requirements

### Environment Variables
```env
# Mailjet MCP
MAILJET_MCP_URL=https://mailjet-agent-prod-d874b6b38888.herokuapp.com
MAILJET_MCP_TOKEN=99720c1062c70118002ebc0cb32359c31739dafe7b3b9fda0f8e6fe856d40ea6
MAILJET_AGENT_ID=campaign-manager-client

# Slack MCP
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
SLACK_SIGNING_SECRET=...
SLACK_CLIENT_ID=...
SLACK_CLIENT_SECRET=...
SLACK_WORKSPACE_ID=...

# Webhook URLs
WEBHOOK_BASE_URL=https://campaign-manager.com/api/webhooks
MAILJET_WEBHOOK_URL=${WEBHOOK_BASE_URL}/mailjet
SLACK_WEBHOOK_URL=${WEBHOOK_BASE_URL}/slack
```

### Database Schema Updates
```prisma
model MCPIntegration {
  id          String   @id @default(uuid())
  service     String   // 'mailjet' | 'slack'
  externalId  String   // Campaign ID in external service
  internalId  String   // Campaign ID in our system
  metadata    Json
  lastSynced  DateTime
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([service, externalId])
  @@index([internalId])
}

model EmailStatistics {
  id              String   @id @default(uuid())
  campaignId      String
  mailjetId       String
  sent            Int      @default(0)
  delivered       Int      @default(0)
  opened          Int      @default(0)
  clicked         Int      @default(0)
  bounced         Int      @default(0)
  unsubscribed    Int      @default(0)
  openRate        Float    @default(0)
  clickRate       Float    @default(0)
  recordedAt      DateTime
  createdAt       DateTime @default(now())

  campaign        Campaign @relation(fields: [campaignId], references: [id])

  @@index([campaignId, recordedAt])
}

model SlackIntegration {
  id              String   @id @default(uuid())
  teamMemberId    String
  slackUserId     String
  slackUsername   String
  channelMappings Json     // Array of {campaignId, channelId}
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  teamMember      TeamMember @relation(fields: [teamMemberId], references: [id])

  @@unique([slackUserId])
  @@index([teamMemberId])
}
```

## Security Considerations

1. **Token Management**
   - Store MCP tokens securely in environment variables
   - Implement token rotation for JWT tokens
   - Use OAuth refresh tokens for Slack

2. **Data Privacy**
   - Encrypt sensitive data in transit
   - Implement data retention policies
   - Respect user consent for notifications

3. **Rate Limiting**
   - Implement rate limiting for MCP calls
   - Use exponential backoff for retries
   - Cache frequently accessed data

4. **Audit Logging**
   - Log all MCP interactions
   - Track data synchronization
   - Monitor for anomalies

## Testing Requirements

1. **Unit Tests**
   - Mock MCP client responses
   - Test error handling
   - Validate data transformations

2. **Integration Tests**
   - Test with staging MCP servers
   - Validate webhook handling
   - Test authentication flows

3. **Load Tests**
   - Test bulk email sending
   - Simulate high-volume Slack notifications
   - Measure sync performance

## Monitoring & Alerting

1. **Metrics to Track**
   - MCP API response times
   - Sync success/failure rates
   - Queue processing times
   - Token expiration warnings

2. **Alerts**
   - MCP service downtime
   - Authentication failures
   - Rate limit warnings
   - Sync job failures

## Timeline

### Week 1-2: Core MCP Client
- Implement MCP client service
- Set up authentication
- Create basic integration tests

### Week 3-4: Email Integration
- Integrate Mailjet campaign sync
- Implement email sending
- Add statistics tracking

### Week 5-6: Slack Integration
- Set up Slack OAuth
- Implement notifications
- Add approval workflows

### Week 7-8: Dashboard & Analytics
- Aggregate metrics
- Create analytics endpoints
- Build monitoring dashboard

## Success Criteria

1. **Functional Requirements**
   - ✅ Sync email statistics in real-time
   - ✅ Send notifications to Slack channels
   - ✅ Process approvals through Slack
   - ✅ Track team activity metrics

2. **Performance Requirements**
   - Response time < 2 seconds for sync operations
   - Support 1000+ concurrent email sends
   - Handle 100+ Slack notifications per minute
   - 99.9% uptime for integrations

3. **Quality Requirements**
   - 80% test coverage for MCP code
   - Zero data loss during sync
   - Full audit trail for all operations
   - Graceful degradation on service failure