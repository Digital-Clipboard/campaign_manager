import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { CacheService } from '@/services/cache/cache.service';
import { CampaignService } from '@/services/campaign/campaign.service';
import { TaskService } from '@/services/task/task.service';
import { TeamService } from '@/services/team/team.service';
import { ApprovalService } from '@/services/approval/approval.service';
import { DashboardService } from '@/services/dashboard/dashboard.service';
import { AnalyticsService } from '@/services/dashboard/analytics.service';
import { NotificationService } from '@/services/notification/notification.service';
import { logger } from '@/utils/logger';
import { z } from 'zod';

// MCP Request/Response models
const CreateCampaignRequest = z.object({
  name: z.string(),
  type: z.enum(['email_blast', 'product_launch', 'webinar', 'newsletter', 'custom']),
  targetDate: z.string().transform(str => new Date(str)),
  objectives: z.array(z.string()).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  description: z.string().optional(),
  budget: z.number().optional(),
  stakeholders: z.array(z.string()).optional()
});

const UpdateCampaignStatusRequest = z.object({
  campaignId: z.string(),
  status: z.enum(['planning', 'preparation', 'review', 'scheduled', 'live', 'completed', 'cancelled']),
  reason: z.string().optional()
});

const GetCampaignAnalyticsRequest = z.object({
  campaignId: z.string()
});

const ListCampaignsRequest = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  type: z.string().optional(),
  limit: z.number().default(10),
  offset: z.number().default(0)
});

const CreateTaskRequest = z.object({
  campaignId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  dueDate: z.string().transform(str => new Date(str)),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  assigneeId: z.string().optional(),
  estimatedHours: z.number().default(1),
  tags: z.array(z.string()).optional()
});

const AssignTaskRequest = z.object({
  taskId: z.string(),
  assigneeId: z.string(),
  notify: z.boolean().default(true)
});

const BulkCreateTasksRequest = z.object({
  campaignId: z.string(),
  tasks: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
    dueDate: z.string(),
    priority: z.string(),
    assigneeId: z.string().optional(),
    estimatedHours: z.number().optional(),
    tags: z.array(z.string()).optional()
  }))
});

const GetTasksByStatusRequest = z.object({
  status: z.enum(['pending', 'assigned', 'in_progress', 'blocked', 'completed']),
  campaignId: z.string().optional(),
  assigneeId: z.string().optional()
});

const GetTeamAvailabilityRequest = z.object({
  date: z.string().transform(str => new Date(str)),
  skills: z.array(z.string()).optional()
});

const UpdateMemberCapacityRequest = z.object({
  memberId: z.string(),
  maxConcurrent: z.number(),
  availability: z.any().optional()
});

const SubmitForApprovalRequest = z.object({
  campaignId: z.string(),
  stage: z.enum(['content', 'compliance', 'executive', 'final']),
  submittedBy: z.string(),
  notes: z.string().optional()
});

const ProcessApprovalRequest = z.object({
  approvalId: z.string(),
  decision: z.enum(['approved', 'rejected', 'needs_revision']),
  comments: z.string().optional(),
  decidedBy: z.string()
});

const GetDashboardMetricsRequest = z.object({
  dateRange: z.object({
    startDate: z.string().transform(str => new Date(str)),
    endDate: z.string().transform(str => new Date(str))
  }).optional(),
  filters: z.object({
    campaignTypes: z.array(z.string()).optional(),
    priorities: z.array(z.string()).optional(),
    statuses: z.array(z.string()).optional()
  }).optional()
});

const GetTrendAnalysisRequest = z.object({
  metric: z.string(),
  startDate: z.string().transform(str => new Date(str)),
  endDate: z.string().transform(str => new Date(str))
});

const ExportDashboardRequest = z.object({
  format: z.enum(['json', 'csv', 'pdf', 'excel']),
  sections: z.array(z.string()),
  dateRange: z.object({
    startDate: z.string().transform(str => new Date(str)),
    endDate: z.string().transform(str => new Date(str))
  })
});

export class MCPServerAdapter {
  private readonly MCP_PROTOCOL_VERSION = '1.0';
  private readonly MCP_SERVER_VERSION = '1.0.0';
  private readonly MCP_SERVER_NAME = 'campaign-manager';

  private prisma: PrismaClient;
  private cacheService: CacheService;
  private campaignService: CampaignService;
  private taskService: TaskService;
  private teamService: TeamService;
  private approvalService: ApprovalService;
  private dashboardService: DashboardService;
  private analyticsService: AnalyticsService;
  private notificationService: NotificationService;

  constructor() {
    this.prisma = new PrismaClient();
    this.cacheService = new CacheService();
    this.campaignService = new CampaignService(this.prisma, this.cacheService);
    this.taskService = new TaskService(this.prisma, this.cacheService);
    this.teamService = new TeamService(this.prisma, this.cacheService);
    this.approvalService = new ApprovalService(this.prisma, this.cacheService);
    this.dashboardService = new DashboardService(this.prisma, this.cacheService);
    this.analyticsService = new AnalyticsService(this.prisma, this.cacheService);
    this.notificationService = new NotificationService(this.prisma);
  }

  registerMCPEndpoint(fastify: FastifyInstance) {
    // Main MCP endpoint that handles all tool calls
    fastify.post('/mcp', {
      schema: {
        body: {
          type: 'object',
          properties: {
            tool: { type: 'string' },
            params: { type: 'object' }
          },
          required: ['tool']
        }
      }
    }, async (request: FastifyRequest<{ Body: { tool: string; params?: any } }>, reply: FastifyReply) => {
      const { tool, params = {} } = request.body;

      logger.info('MCP tool execution', { tool, params });

      try {
        let result: any;

        switch (tool) {
          // Campaign Management Tools
          case 'createCampaign': {
            const validated = CreateCampaignRequest.parse(params);
            result = await this.campaignService.createCampaign({
              name: validated.name,
              type: validated.type,
              targetDate: validated.targetDate,
              objectives: validated.objectives,
              priority: validated.priority,
              description: validated.description,
              budget: validated.budget,
              stakeholders: validated.stakeholders
            }, 'mcp-user');
            break;
          }

          case 'updateCampaignStatus': {
            const validated = UpdateCampaignStatusRequest.parse(params);
            result = await this.campaignService.updateCampaignStatus(
              validated.campaignId,
              validated.status,
              'mcp-user'
            );
            break;
          }

          case 'getCampaignAnalytics': {
            const validated = GetCampaignAnalyticsRequest.parse(params);
            result = await this.dashboardService.getCampaignAnalytics(validated.campaignId);
            break;
          }

          case 'listCampaigns': {
            const validated = ListCampaignsRequest.parse(params);
            result = await this.campaignService.listCampaigns({
              status: validated.status as any,
              priority: validated.priority as any,
              type: validated.type as any,
              pageSize: validated.limit,
              page: Math.floor(validated.offset / validated.limit) + 1
            });
            break;
          }

          // Task Management Tools
          case 'createTask': {
            const validated = CreateTaskRequest.parse(params);
            result = await this.taskService.createTask({
              campaignId: validated.campaignId,
              title: validated.title,
              description: validated.description,
              dueDate: validated.dueDate,
              priority: validated.priority,
              assigneeId: validated.assigneeId,
              estimatedHours: validated.estimatedHours,
              tags: validated.tags
            }, 'mcp-user');
            break;
          }

          case 'assignTask': {
            const validated = AssignTaskRequest.parse(params);
            result = await this.taskService.assignTask(
              validated.taskId,
              validated.assigneeId,
              'mcp-user'
            );
            break;
          }

          case 'bulkCreateTasks': {
            const validated = BulkCreateTasksRequest.parse(params);
            const tasks = [];
            for (const task of validated.tasks) {
              const created = await this.taskService.createTask({
                campaignId: validated.campaignId,
                title: task.title,
                description: task.description,
                dueDate: new Date(task.dueDate),
                priority: task.priority as any,
                assigneeId: task.assigneeId,
                estimatedHours: task.estimatedHours || 1,
                tags: task.tags
              }, 'mcp-user');
              tasks.push(created);
            }
            result = { tasks, count: tasks.length };
            break;
          }

          case 'getTasksByStatus': {
            const validated = GetTasksByStatusRequest.parse(params);
            result = await this.taskService.listTasks({
              status: validated.status,
              campaignId: validated.campaignId,
              assigneeId: validated.assigneeId
            });
            break;
          }

          // Team Management Tools
          case 'getTeamAvailability': {
            const validated = GetTeamAvailabilityRequest.parse(params);
            // Use the provided date as start, and add 7 days for end date
            const startDate = validated.date;
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 7);

            result = await this.teamService.getTeamAvailability(
              startDate,
              endDate,
              validated.skills || []
            );
            break;
          }

          case 'updateMemberCapacity': {
            const validated = UpdateMemberCapacityRequest.parse(params);
            result = await this.teamService.updateTeamMember(
              validated.memberId,
              {
                maxConcurrent: validated.maxConcurrent,
                availability: validated.availability
              },
              'mcp-user'
            );
            break;
          }

          case 'getWorkloadDistribution': {
            const workload = { distribution: [] }; // TODO: implement getWorkloadDistribution
            result = workload;
            break;
          }

          // Approval Management Tools
          case 'submitForApproval': {
            const validated = SubmitForApprovalRequest.parse(params);
            result = await this.approvalService.createApproval({
              campaignId: validated.campaignId,
              stage: validated.stage,
              approverId: 'auto-assigned'
            }, validated.submittedBy);
            break;
          }

          case 'processApproval': {
            const validated = ProcessApprovalRequest.parse(params);
            result = await this.approvalService.processDecision(
              validated.approvalId,
              {
                decision: validated.decision === 'approved' ? 'approve' : validated.decision === 'rejected' ? 'reject' : 'request_changes',
                comments: validated.comments || ''
              },
              validated.decidedBy
            );
            break;
          }

          case 'getApprovalQueue': {
            result = await this.approvalService.listApprovals({ status: 'pending' });
            break;
          }

          // Dashboard & Analytics Tools
          case 'getDashboardMetrics': {
            const validated = GetDashboardMetricsRequest.parse(params);
            result = await this.dashboardService.getOverviewMetrics({
              dateRange: validated.dateRange ? {
                startDate: validated.dateRange.startDate,
                endDate: validated.dateRange.endDate
              } : undefined,
              ...validated.filters
            });
            break;
          }

          case 'getTrendAnalysis': {
            const validated = GetTrendAnalysisRequest.parse(params);
            result = await this.dashboardService.getTrendAnalysis(
              validated.metric,
              { startDate: validated.startDate, endDate: validated.endDate }
            );
            break;
          }

          case 'getRiskAssessment': {
            result = await this.dashboardService.getRiskAssessment();
            break;
          }

          case 'exportDashboard': {
            const validated = ExportDashboardRequest.parse(params);
            const exportData = await this.analyticsService.exportDashboard({
              format: validated.format,
              sections: validated.sections,
              dateRange: {
                startDate: validated.dateRange.startDate,
                endDate: validated.dateRange.endDate
              },
              includeCharts: false
            });
            result = {
              format: exportData.format,
              filename: exportData.filename,
              data: exportData.data.toString('base64')
            };
            break;
          }

          // Notification Tools
          case 'sendNotification': {
            const { recipientId, type, subject, message, urgency } = params;
            result = await this.notificationService.sendNotification({
              recipientId,
              type: type || 'in_app',
              subject,
              message,
              urgency: urgency || 'normal'
            });
            break;
          }

          case 'getNotifications': {
            const { recipientId } = params;
            result = await this.notificationService.getUnreadNotifications(recipientId);
            break;
          }

          default:
            return reply.status(400).send({
              error: {
                code: 'UNKNOWN_TOOL',
                message: `Unknown tool: ${tool}`,
                statusCode: 400
              }
            });
        }

        return reply.status(200).send({ result });

      } catch (error) {
        if (error instanceof z.ZodError) {
          logger.error('MCP validation error', { tool, error: error.errors });
          return reply.status(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid parameters',
              details: error.errors,
              statusCode: 400
            }
          });
        }

        logger.error('MCP tool execution error', { tool, error });
        return reply.status(500).send({
          error: {
            code: 'EXECUTION_ERROR',
            message: error instanceof Error ? error.message : 'Tool execution failed',
            statusCode: 500
          }
        });
      }
    });

    // MCP tools listing endpoint
    fastify.get('/mcp/tools', async (_request: FastifyRequest, reply: FastifyReply) => {
      const tools = [
        // Campaign Management
        {
          name: 'createCampaign',
          description: 'Create a new marketing campaign',
          parameters: CreateCampaignRequest.shape
        },
        {
          name: 'updateCampaignStatus',
          description: 'Update the status of a campaign',
          parameters: UpdateCampaignStatusRequest.shape
        },
        {
          name: 'getCampaignAnalytics',
          description: 'Get detailed analytics for a campaign',
          parameters: GetCampaignAnalyticsRequest.shape
        },
        {
          name: 'listCampaigns',
          description: 'List campaigns with optional filters',
          parameters: ListCampaignsRequest.shape
        },
        // Task Management
        {
          name: 'createTask',
          description: 'Create a new task for a campaign',
          parameters: CreateTaskRequest.shape
        },
        {
          name: 'assignTask',
          description: 'Assign a task to a team member',
          parameters: AssignTaskRequest.shape
        },
        {
          name: 'bulkCreateTasks',
          description: 'Create multiple tasks at once',
          parameters: BulkCreateTasksRequest.shape
        },
        {
          name: 'getTasksByStatus',
          description: 'Get tasks filtered by status',
          parameters: GetTasksByStatusRequest.shape
        },
        // Team Management
        {
          name: 'getTeamAvailability',
          description: 'Get available team members for a date',
          parameters: GetTeamAvailabilityRequest.shape
        },
        {
          name: 'updateMemberCapacity',
          description: 'Update a team member\'s capacity',
          parameters: UpdateMemberCapacityRequest.shape
        },
        {
          name: 'getWorkloadDistribution',
          description: 'Get current workload distribution across team',
          parameters: {}
        },
        // Approval Management
        {
          name: 'submitForApproval',
          description: 'Submit a campaign for approval',
          parameters: SubmitForApprovalRequest.shape
        },
        {
          name: 'processApproval',
          description: 'Process an approval decision',
          parameters: ProcessApprovalRequest.shape
        },
        {
          name: 'getApprovalQueue',
          description: 'Get pending approvals queue',
          parameters: {}
        },
        // Dashboard & Analytics
        {
          name: 'getDashboardMetrics',
          description: 'Get dashboard overview metrics',
          parameters: GetDashboardMetricsRequest.shape
        },
        {
          name: 'getTrendAnalysis',
          description: 'Get trend analysis for a metric',
          parameters: GetTrendAnalysisRequest.shape
        },
        {
          name: 'getRiskAssessment',
          description: 'Get current risk assessment',
          parameters: {}
        },
        {
          name: 'exportDashboard',
          description: 'Export dashboard data in various formats',
          parameters: ExportDashboardRequest.shape
        },
        // Notifications
        {
          name: 'sendNotification',
          description: 'Send a notification',
          parameters: {
            recipientId: 'string',
            type: 'string',
            subject: 'string',
            content: 'string',
            priority: 'string'
          }
        },
        {
          name: 'getNotifications',
          description: 'Get notifications for a user',
          parameters: {
            recipientId: 'string',
            unreadOnly: 'boolean'
          }
        }
      ];

      return reply.status(200).send({ tools });
    });

    // MCP capabilities endpoint
    fastify.get('/mcp/capabilities', async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(200).send({
        protocol_version: this.MCP_PROTOCOL_VERSION,
        server_name: this.MCP_SERVER_NAME,
        server_version: this.MCP_SERVER_VERSION,
        capabilities: {
          tools: {
            list_tools: true,
            call_tool: true
          },
          resources: {
            subscribe: false,
            list_changed: false
          },
          notifications: {
            initialized: true,
            progress: true,
            resources_updated: false
          }
        }
      });
    });

    // Enhanced health check with MCP status
    fastify.get('/mcp/health', async (_request: FastifyRequest, reply: FastifyReply) => {
      const externalConnections: Record<string, string> = {};

      // Check external MCP connections
      try {
        const slackClient = new (await import('@/integrations/mcp-clients/slack-manager-client')).SlackManagerClient();
        externalConnections['slack_manager'] = await slackClient.testConnection() ? 'ok' : 'failed';
      } catch {
        externalConnections['slack_manager'] = 'unavailable';
      }

      try {
        const marketingClient = new (await import('@/integrations/mcp-clients/marketing-agent-client')).MarketingAgentClient();
        externalConnections['marketing_agent'] = await marketingClient.testConnection() ? 'ok' : 'failed';
      } catch {
        externalConnections['marketing_agent'] = 'unavailable';
      }

      try {
        const mailjetClient = new (await import('@/integrations/mcp-clients/mailjet-agent-client')).MailjetAgentClient();
        externalConnections['mailjet_agent'] = await mailjetClient.testConnection() ? 'ok' : 'failed';
      } catch {
        externalConnections['mailjet_agent'] = 'unavailable';
      }

      const allHealthy = Object.values(externalConnections).every(status => status === 'ok');

      return reply.status(200).send({
        status: allHealthy ? 'healthy' : 'degraded',
        version: this.MCP_SERVER_VERSION,
        mcp_protocol: this.MCP_PROTOCOL_VERSION,
        capabilities: ['tools', 'notifications'],
        external_connections: externalConnections,
        timestamp: new Date().toISOString()
      });
    });

    logger.info('MCP server adapter registered');
  }
}