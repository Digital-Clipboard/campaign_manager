// Core type definitions for Campaign Manager

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface Campaign {
  id: string;
  name: string;
  type: 'email_blast' | 'product_launch' | 'webinar' | 'newsletter' | 'custom';
  status: 'planning' | 'preparation' | 'review' | 'scheduled' | 'live' | 'completed' | 'cancelled';
  targetDate: Date;
  objectives: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  budget?: number;
  readinessScore: number;
  createdAt: Date;
  updatedAt: Date;
  timeline?: Timeline;
  tasks?: Task[];
  approvals?: Approval[];
  team?: CampaignTeamMember[];
}

export interface Timeline {
  id: string;
  campaignId: string;
  template: string;
  milestones: Milestone[];
  criticalPath: string[];
  buffer: number;
  estimatedHours: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Milestone {
  id: string;
  name: string;
  description?: string;
  dueDate: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  dependencies: string[];
  tasks: string[];
  phase?: string;
  estimatedHours?: number;
}

export interface Task {
  id: string;
  campaignId: string;
  title: string;
  description?: string;
  assigneeId?: string;
  assignee?: TeamMember;
  dueDate: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'assigned' | 'in_progress' | 'blocked' | 'completed';
  dependencies: string[];
  completedAt?: Date;
  blockedReason?: string;
  estimatedHours: number;
  actualHours: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  comments?: Comment[];
  attachments?: Attachment[];
}

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: string;
  skills: string[];
  timezone: string;
  slackUserId?: string;
  availability: WeeklySchedule;
  maxConcurrent: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WeeklySchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export interface DaySchedule {
  available: boolean;
  startTime?: string; // HH:mm format
  endTime?: string;   // HH:mm format
  timeZone: string;
}

export interface CampaignTeamMember {
  id: string;
  campaignId: string;
  memberId: string;
  member: TeamMember;
  role: 'owner' | 'contributor' | 'reviewer' | 'approver';
  joinedAt: Date;
}

export interface Approval {
  id: string;
  campaignId: string;
  stage: 'content' | 'compliance' | 'executive' | 'final';
  approverId: string;
  approver: TeamMember;
  status: 'pending' | 'approved' | 'rejected' | 'changes_requested';
  comments?: string;
  conditions: string[];
  decidedAt?: Date;
  deadline: Date;
  autoApprove: boolean;
  autoApproveAt?: Date;
  urgency: 'low' | 'normal' | 'high' | 'critical';
  createdAt: Date;
  updatedAt: Date;
}

export interface Notification {
  id: string;
  campaignId?: string;
  type: string;
  senderId?: string;
  recipientId: string;
  channel: 'email' | 'slack' | 'in-app' | 'sms';
  urgency: 'low' | 'normal' | 'high' | 'critical';
  subject?: string;
  message: string;
  payload?: Record<string, any>;
  scheduledFor: Date;
  sentAt?: Date;
  readAt?: Date;
  retries: number;
  maxRetries: number;
  error?: string;
  createdAt: Date;
}

export interface Comment {
  id: string;
  taskId: string;
  authorId: string;
  content: string;
  mentions: string[];
  isInternal: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Attachment {
  id: string;
  taskId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedBy: string;
  createdAt: Date;
}

// API Request/Response types
export interface CreateCampaignRequest {
  name: string;
  type: Campaign['type'];
  targetDate: Date;
  objectives?: string[];
  audience?: {
    segments: string[];
    estimatedSize: number;
  };
  budget?: number;
  priority?: Campaign['priority'];
  description?: string;
  stakeholders?: string[];
  metadata?: Record<string, any>;
  template?: string;
}

export interface CreateCampaignDto {
  name: string;
  type: Campaign['type'];
  targetDate: string;
  objectives: string[];
  audience?: {
    segments: string[];
    estimatedSize: number;
  };
  budget?: number;
  priority: Campaign['priority'];
  owner: string;
  template?: string;
}

export interface UpdateCampaignRequest {
  name?: string;
  type?: Campaign['type'];
  targetDate?: Date;
  status?: Campaign['status'];
  priority?: Campaign['priority'];
  objectives?: string[];
  description?: string;
  budget?: number;
  stakeholders?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateCampaignDto {
  name?: string;
  targetDate?: string;
  status?: Campaign['status'];
  priority?: Campaign['priority'];
  objectives?: string[];
}

export interface CreateTaskDto {
  campaignId: string;
  title: string;
  description?: string;
  assigneeId?: string;
  dueDate: string;
  priority: Task['priority'];
  dependencies?: string[];
  estimatedHours?: number;
  tags?: string[];
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  assigneeId?: string;
  dueDate?: string;
  priority?: Task['priority'];
  status?: Task['status'];
  blockedReason?: string;
  actualHours?: number;
  tags?: string[];
}

export interface CampaignFilters {
  page?: number;
  pageSize?: number;
  status?: Campaign['status'];
  type?: Campaign['type'];
  priority?: Campaign['priority'];
  createdBy?: string;
  search?: string;
  sortBy?: 'createdAt' | 'targetDate' | 'name' | 'status' | 'priority';
  sortOrder?: 'asc' | 'desc';
}

export interface CampaignWithRelations extends Campaign {
  timeline?: Timeline & {
    milestones: Milestone[];
  };
  tasks?: (Task & {
    assignee?: TeamMember;
    dependencies?: Task[];
  })[];
  approvals?: (Approval & {
    approver?: TeamMember;
  })[];
  _count?: {
    tasks: number;
    approvals: number;
  };
}

export interface TaskFilters {
  campaignId?: string;
  assigneeId?: string;
  status?: Task['status'];
  priority?: Task['priority'];
  dueFrom?: string;
  dueTo?: string;
  overdue?: boolean;
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
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

export interface DashboardData {
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
    utilization: number;
  };
  upcomingCampaigns: Campaign[];
  recentActivity: ActivityLog[];
  notifications: Notification[];
}

export interface ActivityLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId?: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

// MCP Tool types
export interface MCPToolCall {
  tool: string;
  parameters: Record<string, any>;
}

export interface MCPToolResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// WebSocket event types
export interface WebSocketEvent {
  event: string;
  data: any;
  timestamp: string;
}

// Error types
export interface APIError {
  code: string;
  message: string;
  statusCode: number;
  timestamp: string;
  requestId: string;
  details?: any;
}