import fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import axios from 'axios';
import jwt from 'jsonwebtoken';

// Extend FastifyRequest type to include startTime
declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
  }
}

// Helper function to convert week number and day to date
function getDateFromWeekAndDay(year: number, weekNumber: number, dayOfWeek: string): Date {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const dayIndex = days.indexOf(dayOfWeek.toLowerCase());

  // Get January 4th of the year (always in week 1 by ISO standard)
  const jan4 = new Date(year, 0, 4);

  // Get the Monday of week 1
  const dayOfWeekJan4 = jan4.getDay() || 7; // Sunday = 7
  const monday1 = new Date(jan4);
  monday1.setDate(jan4.getDate() - dayOfWeekJan4 + 1);

  // Calculate the date for the given week and day
  const targetDate = new Date(monday1);
  targetDate.setDate(monday1.getDate() + (weekNumber - 1) * 7 + dayIndex);

  return targetDate;
}

export async function createServer() {
  const server = fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: process.env.NODE_ENV === 'development' ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname'
        }
      } : undefined
    },
  });

  // Initialize Prisma
  const prisma = new PrismaClient();

  // MailJet MCP helper function
  const generateMailjetToken = () => {
    const mcpToken = process.env.MAILJET_MCP_TOKEN || '99720c1062c70118002ebc0cb32359c31739dafe7b3b9fda0f8e6fe856d40ea6';
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    const payload = {
      agentId: 'campaign-manager-client',
      permissions: ['statistics:read', 'campaigns:read', 'templates:read', 'send:write'],
      expiresAt: expiresAt.toISOString()
    };
    return jwt.sign(payload, mcpToken);
  };

  // Register basic plugins
  await server.register(require('@fastify/cors'), {
    origin: true,
  });

  await server.register(require('@fastify/helmet'));

  // Rate limiting to prevent abuse
  await server.register(require('@fastify/rate-limit'), {
    max: 100, // 100 requests
    timeWindow: '1 minute', // per minute
    errorResponseBuilder: function (request, context) {
      logger.warn('Rate limit exceeded', {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        path: request.url
      });
      return {
        success: false,
        error: 'Too many requests. Please try again later.',
        errorType: 'rate_limit',
        retryAfter: Math.round(context.ttl / 1000),
        timestamp: new Date().toISOString()
      };
    }
  });

  // Request tracking hooks
  server.addHook('onRequest', async (request, reply) => {
    request.startTime = Date.now();
    logger.info('Request started', {
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent']
    });
  });

  server.addHook('onResponse', async (request, reply) => {
    const duration = Date.now() - (request.startTime || Date.now());
    const level = reply.statusCode >= 400 ? 'warn' : 'info';

    logger[level]('Request completed', {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      duration,
      ip: request.ip
    });

    // Log slow requests
    if (duration > 5000) {
      logger.warn('Slow request detected', {
        method: request.method,
        url: request.url,
        duration,
        ip: request.ip
      });
    }
  });

  server.addHook('onError', async (request, reply, error) => {
    logger.error('Request error', {
      method: request.method,
      url: request.url,
      error: error.message,
      stack: error.stack,
      ip: request.ip,
      userAgent: request.headers['user-agent']
    });
  });

  // Basic health check route
  server.get('/health', async (request, reply) => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'campaign-manager',
      version: '1.0.0'
    };
  });

  // Basic root route
  server.get('/', async (request, reply) => {
    return {
      service: 'Campaign Manager',
      version: '1.0.0',
      status: 'running',
      documentation: '/api/docs'
    };
  });

  // Enhanced MCP endpoint with database functionality
  server.post('/mcp', async (request, reply) => {
    const { tool, params = {} } = request.body as any;
    const startTime = Date.now();

    // Log incoming request
    logger.info('MCP request received', {
      tool,
      paramsKeys: Object.keys(params),
      ip: request.ip,
      userAgent: request.headers['user-agent']
    });

    try {
      switch (tool) {
        case 'listCampaigns': {
          const campaigns = await prisma.campaign.findMany({
            take: params.limit || 10,
            skip: params.offset || 0,
            include: {
              tasks: {
                select: { id: true, title: true, status: true }
              }
            }
          });

          const total = await prisma.campaign.count();

          const response = {
            success: true,
            data: {
              campaigns,
              total,
              message: campaigns.length > 0 ? `Found ${campaigns.length} campaigns` : 'No campaigns found - database connected successfully'
            }
          };

          logger.info('MCP request completed', {
            tool,
            success: true,
            duration: Date.now() - startTime,
            resultCount: campaigns.length
          });

          return response;
        }

        case 'createCampaign': {
          const { name, type, targetDate, objectives, priority, description } = params;

          if (!name || !type || !targetDate) {
            return {
              success: false,
              error: 'Missing required fields: name, type, targetDate'
            };
          }

          const campaign = await prisma.campaign.create({
            data: {
              name,
              type: type || 'custom',
              targetDate: new Date(targetDate),
              objectives: objectives || [],
              priority: priority || 'medium',
              description: description || '',
              stakeholders: [],
              readinessScore: 0,
              createdBy: 'mcp-user',
              updatedBy: 'mcp-user'
            }
          });

          return {
            success: true,
            data: {
              campaign,
              message: `Campaign '${name}' created successfully`
            }
          };
        }

        case 'getCampaign': {
          const { campaignId } = params;

          if (!campaignId) {
            return {
              success: false,
              error: 'Missing required field: campaignId'
            };
          }

          const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            include: {
              tasks: true,
              timeline: true,
              approvals: true
            }
          });

          if (!campaign) {
            return {
              success: false,
              error: `Campaign with ID '${campaignId}' not found`
            };
          }

          return {
            success: true,
            data: { campaign }
          };
        }

        case 'createTask': {
          const { campaignId, title, description, dueDate, priority, assigneeId } = params;

          if (!campaignId || !title || !dueDate) {
            return {
              success: false,
              error: 'Missing required fields: campaignId, title, dueDate'
            };
          }

          // Verify campaign exists
          const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId }
          });

          if (!campaign) {
            return {
              success: false,
              error: `Campaign with ID '${campaignId}' not found`
            };
          }

          const task = await prisma.task.create({
            data: {
              campaignId,
              title,
              description: description || '',
              dueDate: new Date(dueDate),
              priority: priority || 'medium',
              assigneeId: assigneeId || null,
              status: 'pending',
              dependencies: [],
              estimatedHours: 1,
              actualHours: 0,
              tags: [],
              createdBy: 'mcp-user',
              updatedBy: 'mcp-user'
            }
          });

          logger.info('Task created via MCP', {
            taskId: task.id,
            campaignId,
            title,
            duration: Date.now() - startTime
          });

          return {
            success: true,
            data: {
              task,
              message: `Task '${title}' created successfully`
            }
          };
        }

        case 'listTasks': {
          const { campaignId, status, assigneeId, limit = 10, offset = 0 } = params;

          const where: any = {};
          if (campaignId) where.campaignId = campaignId;
          if (status) where.status = status;
          if (assigneeId) where.assigneeId = assigneeId;

          const tasks = await prisma.task.findMany({
            where,
            take: limit,
            skip: offset,
            include: {
              campaign: {
                select: { id: true, name: true }
              },
              assignee: {
                select: { id: true, name: true, email: true }
              }
            },
            orderBy: { createdAt: 'desc' }
          });

          const total = await prisma.task.count({ where });

          logger.info('Tasks listed via MCP', {
            count: tasks.length,
            total,
            filters: where,
            duration: Date.now() - startTime
          });

          return {
            success: true,
            data: {
              tasks,
              total,
              message: `Found ${tasks.length} tasks`
            }
          };
        }

        case 'createTeamMember': {
          const { email, name, role, skills, timezone } = params;

          if (!email || !name || !role) {
            return {
              success: false,
              error: 'Missing required fields: email, name, role'
            };
          }

          // Check if team member already exists
          const existingMember = await prisma.teamMember.findUnique({
            where: { email }
          });

          if (existingMember) {
            return {
              success: false,
              error: `Team member with email '${email}' already exists`
            };
          }

          const teamMember = await prisma.teamMember.create({
            data: {
              email,
              name,
              role,
              skills: skills || [],
              timezone: timezone || 'UTC',
              availability: {}, // Default empty availability
              maxConcurrent: 5,
              isActive: true
            }
          });

          logger.info('Team member created via MCP', {
            memberId: teamMember.id,
            email,
            name,
            role,
            duration: Date.now() - startTime
          });

          return {
            success: true,
            data: {
              teamMember,
              message: `Team member '${name}' created successfully`
            }
          };
        }

        case 'listTeamMembers': {
          const { role, isActive, limit = 10, offset = 0 } = params;

          const where: any = {};
          if (role) where.role = role;
          if (isActive !== undefined) where.isActive = isActive;

          const teamMembers = await prisma.teamMember.findMany({
            where,
            take: limit,
            skip: offset,
            include: {
              tasks: {
                where: { status: { in: ['assigned', 'in_progress'] } },
                select: { id: true, title: true, status: true, dueDate: true }
              },
              campaigns: {
                include: {
                  campaign: {
                    select: { id: true, name: true, status: true }
                  }
                }
              }
            },
            orderBy: { createdAt: 'desc' }
          });

          const total = await prisma.teamMember.count({ where });

          logger.info('Team members listed via MCP', {
            count: teamMembers.length,
            total,
            filters: where,
            duration: Date.now() - startTime
          });

          return {
            success: true,
            data: {
              teamMembers,
              total,
              message: `Found ${teamMembers.length} team members`
            }
          };
        }

        case 'getTeamMember': {
          const { memberId } = params;

          if (!memberId) {
            return {
              success: false,
              error: 'Missing required field: memberId'
            };
          }

          const teamMember = await prisma.teamMember.findUnique({
            where: { id: memberId },
            include: {
              tasks: {
                include: {
                  campaign: {
                    select: { id: true, name: true, status: true }
                  }
                },
                orderBy: { dueDate: 'asc' }
              },
              campaigns: {
                include: {
                  campaign: {
                    select: { id: true, name: true, status: true, priority: true }
                  }
                }
              }
            }
          });

          if (!teamMember) {
            return {
              success: false,
              error: `Team member with ID '${memberId}' not found`
            };
          }

          return {
            success: true,
            data: { teamMember }
          };
        }

        case 'assignTaskToMember': {
          const { taskId, memberId } = params;

          if (!taskId || !memberId) {
            return {
              success: false,
              error: 'Missing required fields: taskId, memberId'
            };
          }

          // Verify task exists
          const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: { campaign: { select: { name: true } } }
          });

          if (!task) {
            return {
              success: false,
              error: `Task with ID '${taskId}' not found`
            };
          }

          // Verify team member exists
          const teamMember = await prisma.teamMember.findUnique({
            where: { id: memberId }
          });

          if (!teamMember) {
            return {
              success: false,
              error: `Team member with ID '${memberId}' not found`
            };
          }

          // Update task assignment
          const updatedTask = await prisma.task.update({
            where: { id: taskId },
            data: {
              assigneeId: memberId,
              status: 'assigned',
              updatedBy: 'mcp-user'
            },
            include: {
              assignee: {
                select: { id: true, name: true, email: true }
              },
              campaign: {
                select: { id: true, name: true }
              }
            }
          });

          logger.info('Task assigned via MCP', {
            taskId,
            memberId,
            memberName: teamMember.name,
            taskTitle: task.title,
            campaignName: task.campaign.name,
            duration: Date.now() - startTime
          });

          return {
            success: true,
            data: {
              task: updatedTask,
              message: `Task '${task.title}' assigned to ${teamMember.name}`
            }
          };
        }

        case 'addTeamMemberToCampaign': {
          const { campaignId, memberId, role } = params;

          if (!campaignId || !memberId || !role) {
            return {
              success: false,
              error: 'Missing required fields: campaignId, memberId, role'
            };
          }

          // Verify campaign exists
          const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId }
          });

          if (!campaign) {
            return {
              success: false,
              error: `Campaign with ID '${campaignId}' not found`
            };
          }

          // Verify team member exists
          const teamMember = await prisma.teamMember.findUnique({
            where: { id: memberId }
          });

          if (!teamMember) {
            return {
              success: false,
              error: `Team member with ID '${memberId}' not found`
            };
          }

          // Check if already on campaign team
          const existingMembership = await prisma.campaignTeamMember.findUnique({
            where: {
              campaignId_memberId: {
                campaignId,
                memberId
              }
            }
          });

          if (existingMembership) {
            return {
              success: false,
              error: `Team member '${teamMember.name}' is already on campaign '${campaign.name}'`
            };
          }

          // Add to campaign team
          const campaignTeamMember = await prisma.campaignTeamMember.create({
            data: {
              campaignId,
              memberId,
              role: role // owner, contributor, reviewer, approver
            },
            include: {
              member: {
                select: { id: true, name: true, email: true, role: true }
              },
              campaign: {
                select: { id: true, name: true }
              }
            }
          });

          logger.info('Team member added to campaign via MCP', {
            campaignId,
            memberId,
            memberName: teamMember.name,
            campaignName: campaign.name,
            role,
            duration: Date.now() - startTime
          });

          return {
            success: true,
            data: {
              campaignTeamMember,
              message: `${teamMember.name} added to campaign '${campaign.name}' as ${role}`
            }
          };
        }

        case 'searchMailjetCampaigns': {
          const { subject } = params;
          if (!subject) {
            return {
              success: false,
              error: 'Subject search term is required'
            };
          }

          try {
            const mailjetUrl = process.env.MAILJET_MCP_URL || 'https://mailjet-agent-prod-d874b6b38888.herokuapp.com';
            const response = await axios.post(`${mailjetUrl}/mailjet/campaigns/find_by_subject`, {
              subjectSearch: subject
            }, {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${generateMailjetToken()}`
              },
              timeout: 10000
            });

            return {
              success: true,
              data: response.data.success ? response.data.data : null,
              message: response.data.success ? 'Campaign found' : 'No campaign found with specified subject'
            };
          } catch (error: any) {
            logger.error('Failed to search MailJet campaigns', {
              error: error.message,
              subject
            });
            return {
              success: false,
              error: `MailJet search failed: ${error.message}`
            };
          }
        }

        case 'getMailjetCampaignStats': {
          const { campaignId } = params;
          if (!campaignId) {
            return {
              success: false,
              error: 'Campaign ID is required'
            };
          }

          try {
            const mailjetUrl = process.env.MAILJET_MCP_URL || 'https://mailjet-agent-prod-d874b6b38888.herokuapp.com';
            const response = await axios.post(`${mailjetUrl}/mailjet/campaigns/get_campaign_stats`, {
              campaignId
            }, {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${generateMailjetToken()}`
              },
              timeout: 10000
            });

            return {
              success: true,
              data: response.data.data,
              message: 'Campaign statistics retrieved successfully'
            };
          } catch (error: any) {
            logger.error('Failed to get MailJet campaign stats', {
              error: error.message,
              campaignId
            });
            return {
              success: false,
              error: `Failed to get campaign stats: ${error.message}`
            };
          }
        }

        case 'sendSlackNotification': {
          const { type, campaignName, roundNumber, channel = '#traction' } = params;

          if (!type || !campaignName || !roundNumber) {
            return {
              success: false,
              error: 'Missing required parameters: type, campaignName, roundNumber'
            };
          }

          try {
            // Import notification templates
            const { CampaignSlackNotifications } = await import('../services/slack/campaign-notifications');
            const notifier = new CampaignSlackNotifications();

            let message: any;
            const notificationData = {
              campaignName,
              roundNumber,
              targetCount: params.targetCount || 1000,
              userRange: params.userRange || `users ${(roundNumber - 1) * 1000 + 1}-${roundNumber * 1000}`,
              executionTime: params.executionTime || '10:00 AM EST',
              previousRoundStats: params.previousRoundStats,
              currentProgress: params.currentProgress,
              finalStats: params.finalStats
            };

            switch (type) {
              case 'pre-notification':
                message = notifier.createPreNotification(notificationData);
                break;
              case 'preparation':
                message = notifier.createPreparationNotification(notificationData);
                break;
              case 'about-to-send':
                message = notifier.createAboutToSendNotification(notificationData);
                break;
              case 'execution':
                message = notifier.createExecutionNotification(notificationData);
                break;
              case 'completion':
                message = notifier.createCompletionNotification(notificationData);
                break;
              case 'error':
                message = notifier.createErrorNotification(campaignName, roundNumber, params.error || 'Unknown error');
                break;
              default:
                return {
                  success: false,
                  error: `Unknown notification type: ${type}`
                };
            }

            // Send to Slack via web API
            const slackToken = process.env.SLACK_BOT_TOKEN;
            if (!slackToken) {
              logger.warn('Slack bot token not configured, returning formatted message only');
              return {
                success: true,
                data: {
                  message,
                  channel,
                  note: 'Slack token not configured - message formatted but not sent'
                }
              };
            }

            const slackResponse = await axios.post('https://slack.com/api/chat.postMessage', {
              channel,
              ...message
            }, {
              headers: {
                'Authorization': `Bearer ${slackToken}`,
                'Content-Type': 'application/json'
              }
            });

            if (slackResponse.data.ok) {
              logger.info('Slack notification sent successfully', {
                channel,
                type,
                campaignName,
                roundNumber,
                ts: slackResponse.data.ts
              });

              return {
                success: true,
                data: {
                  messageId: slackResponse.data.ts,
                  channel: slackResponse.data.channel,
                  type,
                  campaignName,
                  roundNumber
                },
                message: 'Slack notification sent successfully'
              };
            }

            return {
              success: false,
              error: `Slack API error: ${slackResponse.data.error}`
            };

          } catch (error: any) {
            logger.error('Failed to send Slack notification', {
              error: error.message,
              type,
              campaignName
            });
            return {
              success: false,
              error: `Failed to send Slack notification: ${error.message}`
            };
          }
        }

        case 'listMailjetCampaigns': {
          const { limit = 10, offset = 0 } = params;

          try {
            const mailjetUrl = process.env.MAILJET_MCP_URL || 'https://mailjet-agent-prod-d874b6b38888.herokuapp.com';
            const response = await axios.post(`${mailjetUrl}/mailjet/campaigns/list`, {
              limit,
              offset
            }, {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${generateMailjetToken()}`
              },
              timeout: 10000
            });

            return {
              success: true,
              data: response.data.data,
              message: `Retrieved ${response.data.data.campaigns.length} campaigns`
            };
          } catch (error: any) {
            logger.error('Failed to list MailJet campaigns', {
              error: error.message
            });
            return {
              success: false,
              error: `Failed to list campaigns: ${error.message}`
            };
          }
        }

        // Campaign Schedule Management Tools
        case 'scheduleActivity': {
          const { weekNumber, year, dayOfWeek, time, activityType, name, campaignId, recipientCount, segment, details } = params;
          if (!weekNumber || !year || !dayOfWeek || !time || !activityType || !name) {
            return {
              success: false,
              error: 'Missing required fields: weekNumber, year, dayOfWeek, time, activityType, name'
            };
          }
          try {
            // Calculate scheduled date from week/day
            const scheduledDate = getDateFromWeekAndDay(year, weekNumber, dayOfWeek);

            const activity = await prisma.campaignSchedule.create({
              data: {
                weekNumber,
                year,
                dayOfWeek,
                scheduledDate,
                time,
                activityType,
                name,
                campaignId: campaignId || null,
                roundNumber: params.roundNumber || null,
                recipientCount: recipientCount || null,
                segment: segment || null,
                details: details || null,
                status: 'scheduled'
              }
            });

            return {
              success: true,
              activity,
              message: `Activity scheduled for ${dayOfWeek}, Week ${weekNumber} ${year} at ${time}`
            };
          } catch (error) {
            return {
              success: false,
              error: `Failed to schedule activity: ${error.message}`
            };
          }
        }

        case 'getWeekSchedule': {
          const { weekNumber, year } = params;
          if (!weekNumber || !year) {
            return {
              success: false,
              error: 'Missing required fields: weekNumber, year'
            };
          }
          try {
            const activities = await prisma.campaignSchedule.findMany({
              where: {
                weekNumber: parseInt(weekNumber),
                year: parseInt(year)
              },
              include: {
                campaign: true
              },
              orderBy: [
                { scheduledDate: 'asc' },
                { time: 'asc' }
              ]
            });

            // Group by day
            const schedule = activities.reduce((acc, activity) => {
              if (!acc[activity.dayOfWeek]) {
                acc[activity.dayOfWeek] = [];
              }
              acc[activity.dayOfWeek].push(activity);
              return acc;
            }, {} as Record<string, any>);

            return {
              success: true,
              weekNumber,
              year,
              schedule,
              totalActivities: activities.length
            };
          } catch (error) {
            return {
              success: false,
              error: `Failed to get week schedule: ${error.message}`
            };
          }
        }

        case 'updateActivityStatus': {
          const { activityId, status } = params;
          if (!activityId || !status) {
            return {
              success: false,
              error: 'Missing required fields: activityId, status'
            };
          }
          try {
            const updated = await prisma.campaignSchedule.update({
              where: { id: activityId },
              data: {
                status,
                updatedAt: new Date()
              }
            });

            return {
              success: true,
              activity: updated,
              message: `Activity status updated to ${status}`
            };
          } catch (error) {
            return {
              success: false,
              error: `Failed to update activity status: ${error.message}`
            };
          }
        }

        case 'initializeDashboardAccess': {
          const teamMembers = [
            { name: 'John Kelly', email: 'john.kelly@company.com' },
            { name: 'Jenny Huang', email: 'jenny.huang@company.com' },
            { name: 'David James', email: 'david.james@company.com' },
            { name: 'Brian James', email: 'brian.james@company.com' },
            { name: 'Otto Vacheishvili', email: 'otto.vacheishvili@company.com' },
            { name: 'Gonzalo Hardy', email: 'gonzalo.hardy@company.com' }
          ];

          try {
            const accessTokens = [];

            for (const member of teamMembers) {
              // Generate unique access token
              const accessToken = Buffer.from(`${member.email}:${Date.now()}:${Math.random()}`).toString('base64');

              // Create or update dashboard access
              const access = await prisma.dashboardAccess.upsert({
                where: { email: member.email },
                update: {
                  name: member.name,
                  accessToken,
                  isActive: true
                },
                create: {
                  name: member.name,
                  email: member.email,
                  accessToken,
                  isActive: true
                }
              });

              accessTokens.push({
                name: member.name,
                email: member.email,
                accessToken: access.accessToken,
                dashboardUrl: `${process.env.DASHBOARD_URL || 'https://campaign-dashboard.vercel.app'}?token=${access.accessToken}`
              });
            }

            return {
              success: true,
              message: 'Dashboard access tokens created',
              accessTokens
            };
          } catch (error) {
            return {
              success: false,
              error: `Failed to initialize dashboard access: ${error.message}`
            };
          }
        }

        case 'verifyDashboardToken': {
          const { token } = params;
          if (!token) {
            return { success: false, error: 'Token required' };
          }

          try {
            // Check if token exists and is active
            const access = await prisma.dashboardAccess.findFirst({
              where: {
                accessToken: token,
                isActive: true
              }
            });

            if (access) {
              // Update last accessed time
              await prisma.dashboardAccess.update({
                where: { id: access.id },
                data: { lastAccess: new Date() }
              });

              return {
                success: true,
                valid: true,
                name: access.name,
                email: access.email
              };
            } else {
              return {
                success: false,
                valid: false,
                error: 'Invalid or inactive token'
              };
            }
          } catch (error) {
            return {
              success: false,
              error: `Failed to verify token: ${error.message}`
            };
          }
        }

        default:
          return {
            success: false,
            error: `Tool '${tool}' not implemented`,
            availableTools: [
              'listCampaigns', 'createCampaign', 'getCampaign',
              'createTask', 'listTasks',
              'createTeamMember', 'listTeamMembers', 'getTeamMember',
              'assignTaskToMember', 'addTeamMemberToCampaign',
              'searchMailjetCampaigns', 'getMailjetCampaignStats', 'listMailjetCampaigns',
              'sendSlackNotification',
              'scheduleActivity', 'getWeekSchedule', 'updateActivityStatus', 'initializeDashboardAccess'
            ]
          };
      }
    } catch (error) {
      const errorDetails = {
        tool,
        error: error.message,
        duration: Date.now() - startTime,
        stack: error.stack,
        params: Object.keys(params),
        ip: request.ip,
        userAgent: request.headers['user-agent']
      };

      logger.error('MCP endpoint error', errorDetails);

      // Store error in activity log for tracking
      try {
        await prisma.activityLog.create({
          data: {
            type: 'error',
            entityType: 'mcp',
            entityId: tool,
            action: 'tool_execution_failed',
            performedBy: 'mcp-user',
            details: {
              error: error.message,
              tool,
              duration: Date.now() - startTime,
              params: Object.keys(params)
            },
            ipAddress: request.ip,
            userAgent: request.headers['user-agent']
          }
        });
      } catch (logError) {
        // Don't fail the request if logging fails
        logger.warn('Could not log MCP error to activity log', { logError: logError.message });
      }

      // Determine error type for better client handling
      const isDatabaseError = error.message.includes('prisma') ||
                             error.message.includes('database') ||
                             error.message.includes('connection');

      const isValidationError = error.message.includes('validation') ||
                               error.message.includes('required') ||
                               error.message.includes('invalid');

      return {
        success: false,
        error: isDatabaseError ? `Database error: ${error.message}` :
               isValidationError ? `Validation error: ${error.message}` :
               `Server error: ${error.message}`,
        errorType: isDatabaseError ? 'database' :
                   isValidationError ? 'validation' : 'server',
        timestamp: new Date().toISOString(),
        requestId: `mcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };
    }
  });

  // Metrics endpoint for monitoring
  server.get('/metrics', async (request, reply) => {
    try {
      const [
        campaignCount,
        taskCount,
        teamMemberCount,
        recentCampaigns,
        recentErrors
      ] = await Promise.all([
        prisma.campaign.count(),
        prisma.task.count(),
        prisma.teamMember.count(),
        prisma.campaign.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: { id: true, name: true, status: true, createdAt: true }
        }),
        // Get recent activity logs for errors
        prisma.activityLog.findMany({
          where: {
            type: 'error'
          },
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            entityType: true,
            action: true,
            createdAt: true,
            details: true
          }
        }).catch(() => []) // Graceful fallback if activity log doesn't exist
      ]);

      const uptime = process.uptime();
      const memoryUsage = process.memoryUsage();

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: {
          seconds: Math.floor(uptime),
          formatted: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`
        },
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          unit: 'MB'
        },
        metrics: {
          campaigns: {
            total: campaignCount
          },
          tasks: {
            total: taskCount
          },
          teamMembers: {
            total: teamMemberCount
          },
          database: {
            connected: true,
            lastQuery: new Date().toISOString()
          }
        },
        recentActivity: recentCampaigns,
        recentErrors: recentErrors.length > 0 ? recentErrors : []
      };
    } catch (error) {
      logger.error('Metrics endpoint error', { error: error.message });
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  });

  // Health check with detailed status
  server.get('/health/detailed', async (request, reply) => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'campaign-manager',
      version: '1.0.0',
      checks: {
        database: { status: 'unknown', responseTime: 0 },
        memory: { status: 'unknown', usage: 0 },
        uptime: { status: 'healthy', seconds: process.uptime() }
      }
    };

    try {
      // Database health check
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const dbResponseTime = Date.now() - dbStart;

      health.checks.database = {
        status: dbResponseTime < 1000 ? 'healthy' : 'slow',
        responseTime: dbResponseTime
      };

      // Memory health check
      const memoryUsage = process.memoryUsage();
      const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

      health.checks.memory = {
        status: memoryUsagePercent < 80 ? 'healthy' : 'warning',
        usage: Math.round(memoryUsagePercent)
      };

      // Overall status
      const hasUnhealthy = Object.values(health.checks).some(check =>
        check.status === 'error' || check.status === 'critical'
      );
      const hasWarning = Object.values(health.checks).some(check =>
        check.status === 'warning' || check.status === 'slow'
      );

      if (hasUnhealthy) {
        health.status = 'unhealthy';
        reply.status(503);
      } else if (hasWarning) {
        health.status = 'warning';
      }

      return health;
    } catch (error) {
      logger.error('Detailed health check failed', { error: error.message });
      health.status = 'unhealthy';
      health.checks.database.status = 'error';
      reply.status(503);
      return health;
    }
  });

  // Error reporting endpoint
  server.post('/errors/report', async (request, reply) => {
    const { error, context, severity = 'error' } = request.body as any;

    try {
      // Log the error
      logger.error('Client-reported error', {
        error: error?.message || error,
        context,
        severity,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        timestamp: new Date().toISOString()
      });

      // Store in activity log if available
      try {
        await prisma.activityLog.create({
          data: {
            type: 'error',
            entityType: 'system',
            entityId: 'client-error',
            action: 'error_reported',
            performedBy: 'client',
            details: {
              error: error?.message || error,
              context,
              severity,
              ip: request.ip,
              userAgent: request.headers['user-agent']
            }
          }
        });
      } catch (dbError) {
        // Graceful fallback if activity log isn't available
        logger.warn('Could not store error in activity log', { dbError: dbError.message });
      }

      return {
        success: true,
        message: 'Error reported successfully',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error reporting endpoint failed', { error: error.message });
      return {
        success: false,
        error: 'Failed to report error'
      };
    }
  });

  // Cleanup Prisma connection on server close
  server.addHook('onClose', async () => {
    await prisma.$disconnect();
    logger.info('Prisma client disconnected');
  });

  return server;
}