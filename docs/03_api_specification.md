# Campaign Manager - API Specification

## Document Information
- Version: 1.0
- Date: 2025-09-20
- Status: Active
- Purpose: Define RESTful API endpoints and MCP tools for Campaign Manager
- Format: OpenAPI 3.0 compatible

## Base Configuration

### Server Information
```yaml
servers:
  - url: http://localhost:3001/api/v1
    description: Development server
  - url: https://campaign-manager.digitalclipboard.io/api/v1
    description: Production server

security:
  - bearerAuth: []

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

## Authentication Endpoints

### POST /auth/login
Login and receive JWT token

#### Request
```typescript
{
  email: string;
  password: string;
}
```

#### Response
```typescript
{
  success: boolean;
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  expiresIn: number; // seconds
}
```

### POST /auth/refresh
Refresh JWT token

#### Request
```typescript
{
  refreshToken: string;
}
```

#### Response
```typescript
{
  success: boolean;
  token: string;
  expiresIn: number;
}
```

## Campaign Management Endpoints

### GET /campaigns
List all campaigns with filtering

#### Query Parameters
```typescript
{
  status?: 'planning' | 'preparation' | 'review' | 'scheduled' | 'live' | 'completed';
  type?: string;
  assignee?: string;
  from?: string; // ISO date
  to?: string;   // ISO date
  page?: number;
  limit?: number;
  sort?: 'created' | 'targetDate' | 'name';
  order?: 'asc' | 'desc';
}
```

#### Response
```typescript
{
  campaigns: Campaign[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}
```

### GET /campaigns/:id
Get campaign details

#### Response
```typescript
{
  id: string;
  name: string;
  type: string;
  status: string;
  targetDate: string;
  timeline: {
    template: string;
    milestones: Milestone[];
    criticalPath: string[];
    buffer: number;
  };
  tasks: {
    total: number;
    completed: number;
    inProgress: number;
    blocked: number;
  };
  team: TeamMember[];
  approvals: Approval[];
  readinessScore: number; // 0-100
  createdAt: string;
  updatedAt: string;
}
```

### POST /campaigns
Create new campaign

#### Request
```typescript
{
  name: string;
  type: 'email_blast' | 'product_launch' | 'webinar' | 'newsletter' | 'custom';
  targetDate: string;
  objectives: string[];
  audience: {
    segments: string[];
    estimatedSize: number;
  };
  budget?: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  owner: string; // team member ID
  template?: string; // timeline template
}
```

#### Response
```typescript
{
  success: boolean;
  campaign: Campaign;
  timeline: Timeline;
  tasks: Task[];
}
```

### PUT /campaigns/:id
Update campaign

#### Request
```typescript
{
  name?: string;
  targetDate?: string;
  status?: string;
  priority?: string;
  objectives?: string[];
}
```

### DELETE /campaigns/:id
Cancel campaign

#### Response
```typescript
{
  success: boolean;
  message: string;
  cancelledTasks: number;
}
```

### POST /campaigns/:id/launch
Launch campaign (handoff to Marketing Agent)

#### Request
```typescript
{
  confirmChecks: boolean;
  overrideWarnings?: boolean;
}
```

#### Response
```typescript
{
  success: boolean;
  handoffId: string;
  warnings: string[];
  marketingAgentResponse: any;
}
```

## Task Management Endpoints

### GET /tasks
Get tasks with filtering

#### Query Parameters
```typescript
{
  campaignId?: string;
  assigneeId?: string;
  status?: 'pending' | 'assigned' | 'in_progress' | 'blocked' | 'completed';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  dueFrom?: string;
  dueTo?: string;
  overdue?: boolean;
}
```

### GET /tasks/:id
Get task details

#### Response
```typescript
{
  id: string;
  campaign: {
    id: string;
    name: string;
  };
  title: string;
  description: string;
  assignee: TeamMember;
  dueDate: string;
  priority: string;
  status: string;
  dependencies: Task[];
  blockedReason?: string;
  timeTracked: number; // minutes
  comments: Comment[];
  attachments: Attachment[];
  history: TaskHistory[];
}
```

### POST /tasks
Create task

#### Request
```typescript
{
  campaignId: string;
  title: string;
  description?: string;
  assigneeId?: string;
  dueDate: string;
  priority: string;
  dependencies?: string[];
}
```

### PUT /tasks/:id
Update task

#### Request
```typescript
{
  title?: string;
  description?: string;
  assigneeId?: string;
  dueDate?: string;
  priority?: string;
  status?: string;
  blockedReason?: string;
}
```

### POST /tasks/:id/complete
Mark task as complete

#### Request
```typescript
{
  notes?: string;
  timeSpent?: number; // minutes
  attachments?: string[];
}
```

### POST /tasks/:id/comment
Add comment to task

#### Request
```typescript
{
  text: string;
  mentions?: string[]; // user IDs
}
```

## Team Management Endpoints

### GET /team
Get team members

#### Response
```typescript
{
  members: TeamMember[];
  statistics: {
    total: number;
    available: number;
    busy: number;
    outOfOffice: number;
  };
}
```

### GET /team/:id/workload
Get team member workload

#### Response
```typescript
{
  member: TeamMember;
  currentTasks: Task[];
  upcomingTasks: Task[];
  completedThisWeek: number;
  averageCompletionTime: number; // hours
  utilization: number; // percentage
  availability: {
    today: number; // available hours
    thisWeek: number;
    nextWeek: number;
  };
}
```

### POST /team/:id/availability
Update team member availability

#### Request
```typescript
{
  date: string;
  available: boolean;
  hours?: number;
  note?: string;
}
```

## Approval Endpoints

### GET /approvals
Get pending approvals

#### Query Parameters
```typescript
{
  campaignId?: string;
  approverId?: string;
  status?: 'pending' | 'approved' | 'rejected';
  urgency?: 'low' | 'normal' | 'high' | 'critical';
}
```

### POST /approvals/:id/decide
Make approval decision

#### Request
```typescript
{
  decision: 'approve' | 'reject' | 'request_changes';
  comments: string;
  conditions?: string[];
}
```

## Notification Endpoints

### GET /notifications
Get notifications for current user

#### Query Parameters
```typescript
{
  unread?: boolean;
  type?: string;
  from?: string;
  to?: string;
  limit?: number;
}
```

### PUT /notifications/:id/read
Mark notification as read

### POST /notifications/bulk-read
Mark multiple notifications as read

#### Request
```typescript
{
  ids: string[];
}
```

## Dashboard Endpoints

### GET /dashboard
Get dashboard overview

#### Response
```typescript
{
  campaigns: {
    active: number;
    scheduled: number;
    completed: number;
    atRisk: number;
  };
  tasks: {
    total: number;
    myTasks: number;
    overdue: number;
    dueToday: number;
    blocked: number;
  };
  team: {
    totalMembers: number;
    available: number;
    utilization: number; // percentage
  };
  upcomingCampaigns: Campaign[];
  recentActivity: Activity[];
  notifications: Notification[];
}
```

### GET /dashboard/calendar
Get calendar view data

#### Query Parameters
```typescript
{
  view: 'day' | 'week' | 'month';
  date: string;
}
```

#### Response
```typescript
{
  campaigns: CampaignCalendarItem[];
  tasks: TaskCalendarItem[];
  milestones: MilestoneCalendarItem[];
  teamAvailability: TeamAvailability[];
}
```

## Reporting Endpoints

### GET /reports/campaign/:id
Get campaign report

#### Response
```typescript
{
  campaign: Campaign;
  metrics: {
    tasksCompleted: number;
    tasksOnTime: number;
    averageCompletionTime: number;
    escalations: number;
    revisions: number;
  };
  timeline: {
    plannedDuration: number;
    actualDuration: number;
    delays: Delay[];
  };
  team: {
    contributors: TeamMember[];
    workload: WorkloadDistribution;
  };
  approvals: {
    firstTimeApproval: number; // percentage
    averageApprovalTime: number; // hours
    rejections: Rejection[];
  };
}
```

### GET /reports/team
Get team performance report

#### Query Parameters
```typescript
{
  from: string;
  to: string;
  memberId?: string;
}
```

### GET /reports/productivity
Get productivity metrics

#### Response
```typescript
{
  period: string;
  metrics: {
    campaignsCompleted: number;
    tasksCompleted: number;
    averageTaskTime: number;
    onTimeDelivery: number; // percentage
    utilizationRate: number; // percentage
  };
  trends: {
    productivity: number[]; // daily values
    efficiency: number[];
    quality: number[];
  };
  bottlenecks: Bottleneck[];
  recommendations: string[];
}
```

## Webhook Endpoints

### POST /webhooks/slack
Receive Slack events

#### Request
```typescript
{
  type: 'url_verification' | 'event_callback';
  challenge?: string;
  event?: {
    type: string;
    user: string;
    channel: string;
    text: string;
    ts: string;
  };
}
```

### POST /webhooks/mailjet
Receive Mailjet events

#### Request
```typescript
{
  event: 'campaign_sent' | 'campaign_failed';
  campaignId: string;
  timestamp: string;
  data: any;
}
```

## WebSocket Events

### Client -> Server

#### subscribe
```typescript
{
  event: 'subscribe';
  data: {
    type: 'campaign' | 'user' | 'team';
    id: string;
  };
}
```

#### task:update
```typescript
{
  event: 'task:update';
  data: {
    taskId: string;
    updates: Partial<Task>;
  };
}
```

### Server -> Client

#### campaign:update
```typescript
{
  event: 'campaign:update';
  data: {
    campaignId: string;
    updates: Partial<Campaign>;
    timestamp: string;
  };
}
```

#### task:assigned
```typescript
{
  event: 'task:assigned';
  data: {
    task: Task;
    assignee: TeamMember;
  };
}
```

#### notification:new
```typescript
{
  event: 'notification:new';
  data: {
    notification: Notification;
  };
}
```

## MCP Tool Specifications

### Tools Exposed by Campaign Manager

#### cm_get_campaign_status
Get current campaign status
```typescript
{
  name: "cm_get_campaign_status",
  description: "Get detailed status of a campaign",
  inputSchema: {
    type: "object",
    properties: {
      campaign_id: { type: "string" }
    },
    required: ["campaign_id"]
  },
  returns: {
    campaign: Campaign,
    readiness: number,
    blockers: string[],
    nextMilestone: Milestone
  }
}
```

#### cm_create_campaign
Create new campaign
```typescript
{
  name: "cm_create_campaign",
  description: "Create a new campaign with timeline",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string" },
      type: { type: "string" },
      target_date: { type: "string" },
      template: { type: "string" }
    },
    required: ["name", "type", "target_date"]
  },
  returns: {
    campaign_id: string,
    timeline: Timeline,
    tasks: Task[]
  }
}
```

#### cm_assign_task
Assign task to team member
```typescript
{
  name: "cm_assign_task",
  description: "Assign or reassign a task",
  inputSchema: {
    type: "object",
    properties: {
      task_id: { type: "string" },
      assignee_id: { type: "string" },
      due_date: { type: "string" }
    },
    required: ["task_id", "assignee_id"]
  }
}
```

#### cm_escalate_issue
Escalate a blocker or issue
```typescript
{
  name: "cm_escalate_issue",
  description: "Escalate an issue to management",
  inputSchema: {
    type: "object",
    properties: {
      type: { type: "string" },
      severity: { type: "string" },
      campaign_id: { type: "string" },
      description: { type: "string" }
    },
    required: ["type", "severity", "description"]
  }
}
```

### Tools Used by Campaign Manager

#### From Slack Manager
- `slack_post_message`: Post to channel
- `slack_send_dm`: Send direct message
- `slack_create_thread`: Start discussion thread
- `slack_add_reminder`: Set reminder for user

#### From Marketing Agent
- `ma_get_campaign_performance`: Get historical performance
- `ma_get_audience_insights`: Get audience data
- `ma_predict_performance`: Get performance predictions

#### From Mailjet Agent
- `mj_validate_campaign`: Technical validation
- `mj_check_deliverability`: Deliverability check
- `mj_schedule_send`: Schedule campaign send

## Error Responses

### Standard Error Format
```typescript
{
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId: string;
  }
}
```

### Error Codes
- `AUTH_001`: Invalid credentials
- `AUTH_002`: Token expired
- `AUTH_003`: Insufficient permissions
- `CAMP_001`: Campaign not found
- `CAMP_002`: Campaign already launched
- `CAMP_003`: Campaign has blockers
- `TASK_001`: Task not found
- `TASK_002`: Task has dependencies
- `TASK_003`: Invalid task status transition
- `TEAM_001`: Team member not found
- `TEAM_002`: Team member overloaded
- `VAL_001`: Invalid input data
- `VAL_002`: Missing required field
- `RATE_001`: Rate limit exceeded
- `SRV_001`: Internal server error

## Rate Limiting

### Limits by Endpoint
```yaml
endpoints:
  auth:
    login: 5 requests per minute
    refresh: 10 requests per minute

  campaigns:
    list: 100 requests per minute
    create: 10 requests per minute
    update: 50 requests per minute

  tasks:
    list: 100 requests per minute
    update: 100 requests per minute
    comment: 50 requests per minute

  webhooks:
    slack: 1000 requests per minute
    mailjet: 100 requests per minute
```

## Pagination

### Standard Pagination Parameters
```typescript
{
  page: number;    // default: 1
  limit: number;   // default: 20, max: 100
  sort: string;    // field to sort by
  order: 'asc' | 'desc'; // default: 'desc'
}
```

### Pagination Response
```typescript
{
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}