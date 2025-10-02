/**
 * Lifecycle Services
 * Export all lifecycle-related services
 */

// Foundation Services
export { CampaignScheduleService } from './campaign-schedule.service';
export type { BatchSchedule, CreateCampaignScheduleParams } from './campaign-schedule.service';

export { CampaignMetricsService } from './campaign-metrics.service';
export type { CampaignMetricsData, MetricDeltas } from './campaign-metrics.service';

export { NotificationLogService } from './notification-log.service';

// Core Services
export { PreFlightVerificationService } from './preflight-verification.service';
export type { PreFlightResult } from './preflight-verification.service';

export { MetricsCollectionService } from './metrics-collection.service';
export type { MetricsCollectionResult } from './metrics-collection.service';

export { NotificationService } from './notification.service';
export type { NotificationContext, NotificationResult } from './notification.service';

// Orchestration
export { CampaignOrchestratorService } from './campaign-orchestrator.service';
export type {
  CampaignCreationParams,
  CampaignLaunchParams,
  CampaignOrchestrationResult
} from './campaign-orchestrator.service';

// AI Agents
export * from './agents';
