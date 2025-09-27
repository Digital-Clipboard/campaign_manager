// Dashboard and Analytics Type Definitions

import { Campaign, TeamMember } from './index';

export interface DashboardMetrics {
  // Campaign metrics
  totalCampaigns: number;
  activeCampaigns: number;
  campaignsByStatus: Record<string, number>;
  upcomingDeadlines: Campaign[];
  campaignCompletionRate: number;
  averageCampaignDuration: number;

  // Task metrics
  totalTasks: number;
  overdueTasks: number;
  taskCompletionRate: number;
  tasksByPriority: Record<string, number>;
  tasksByStatus: Record<string, number>;
  averageTaskCompletionTime: number;

  // Team metrics
  teamUtilization: number;
  availableMembers: TeamMember[];
  workloadDistribution: WorkloadData[];
  teamProductivity: number;

  // Performance metrics
  avgCampaignDuration: number;
  avgTaskCompletionTime: number;
  approvalBottlenecks: ApprovalDelay[];
  performanceTrends: TrendData[];

  // System metrics
  systemHealth: SystemHealthStatus;
  lastUpdated: Date;
}

export interface WorkloadData {
  memberId: string;
  memberName: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  utilization: number;
  estimatedHoursRemaining: number;
}

export interface ApprovalDelay {
  campaignId: string;
  campaignName: string;
  stage: string;
  delayHours: number;
  approverId?: string;
  dueDate: Date;
  priority: string;
}

export interface CampaignAnalytics {
  campaignId: string;
  metrics: {
    readinessScore: number;
    completionPercentage: number;
    tasksCompleted: number;
    tasksPending: number;
    overdueTaskCount: number;
    teamMembers: number;
    estimatedHoursRemaining: number;
    actualHoursSpent: number;
    efficiency: number;
  };
  timeline: {
    startDate: Date;
    targetDate: Date;
    estimatedCompletionDate: Date;
    criticalPathStatus: string;
    bufferRemaining: number;
    milestoneCompletion: MilestoneStatus[];
  };
  risks: RiskIndicator[];
  recommendations: string[];
}

export interface MilestoneStatus {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  completionPercentage: number;
  dueDate: Date;
  completedAt?: Date;
}

export interface TeamPerformance {
  period: DateRange;
  metrics: {
    tasksCompleted: number;
    averageCompletionTime: number;
    onTimeDeliveryRate: number;
    productivityScore: number;
    capacityUtilization: number;
  };
  memberPerformance: MemberPerformance[];
  trends: {
    productivity: TrendData;
    efficiency: TrendData;
    workload: TrendData;
  };
}

export interface MemberPerformance {
  memberId: string;
  name: string;
  metrics: {
    tasksCompleted: number;
    tasksAssigned: number;
    completionRate: number;
    averageTime: number;
    efficiency: number;
    qualityScore: number;
  };
}

export interface RiskIndicator {
  type: 'schedule' | 'resource' | 'budget' | 'quality' | 'approval';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedItems: string[];
  mitigationSteps?: string[];
  probability: number;
  impact: number;
  riskScore: number;
}

export interface TrendData {
  metric: string;
  period: DateRange;
  dataPoints: DataPoint[];
  trend: 'increasing' | 'decreasing' | 'stable';
  changePercentage: number;
  forecast?: DataPoint[];
}

export interface DataPoint {
  timestamp: Date;
  value: number;
  label?: string;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface SystemHealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  services: ServiceStatus[];
  lastCheck: Date;
}

export interface ServiceStatus {
  name: string;
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  errorRate?: number;
  details?: string;
}

export interface DashboardFilters {
  dateRange?: DateRange;
  campaignTypes?: string[];
  priorities?: string[];
  teamMembers?: string[];
  statuses?: string[];
  tags?: string[];
}

export interface ExportOptions {
  format: 'json' | 'csv' | 'pdf' | 'excel';
  includeCharts: boolean;
  sections: string[];
  dateRange: DateRange;
}

export interface DashboardExport {
  generatedAt: Date;
  format: string;
  data: Buffer;
  filename: string;
  mimeType: string;
}

export interface RealTimeUpdate {
  type: 'campaign' | 'task' | 'approval' | 'team' | 'notification';
  action: 'created' | 'updated' | 'deleted' | 'completed';
  entityId: string;
  data: any;
  timestamp: Date;
}

export interface DashboardCacheConfig {
  overviewTTL: number;       // 5 minutes
  trendsTTL: number;          // 1 hour
  teamMetricsTTL: number;     // 10 minutes
  campaignAnalyticsTTL: number; // 15 minutes
  riskAssessmentTTL: number;  // 30 minutes
}

export interface AnalyticsQuery {
  metrics: string[];
  groupBy?: string[];
  filters?: DashboardFilters;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface MetricDefinition {
  id: string;
  name: string;
  category: 'campaign' | 'task' | 'team' | 'performance' | 'system';
  calculation: string;
  unit?: string;
  format?: string;
  description: string;
}

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'list' | 'table' | 'gauge';
  title: string;
  metrics: string[];
  refreshInterval?: number;
  config?: any;
}

export interface DashboardLayout {
  id: string;
  name: string;
  widgets: DashboardWidget[];
  isDefault: boolean;
  createdBy: string;
  updatedAt: Date;
}