/**
 * Lifecycle Campaign MCP Server
 * Provides MCP tools for managing Q4 2025 marketing campaign schedule
 * and 3-round lifecycle email campaigns
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient, CampaignStatus } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Tool schemas
const CreateLifecycleCampaignSchema = z.object({
  campaignName: z.string().describe('Name of the campaign (e.g., "Client Letter Automation")'),
  listIdPrefix: z.string().describe('Prefix for MailJet list IDs'),
  subject: z.string().describe('Email subject line with merge tags'),
  senderName: z.string().describe('Sender display name'),
  senderEmail: z.string().email().describe('Sender email address'),
  totalRecipients: z.number().int().describe('Total number of recipients across all 3 rounds'),
  mailjetListIds: z.array(z.number()).length(3).describe('Array of 3 MailJet list IDs for rounds 1-3'),
  mailjetTemplateId: z.number().int().describe('MailJet template ID'),
  notificationChannel: z.string().describe('Slack channel for notifications (e.g., "#_traction")'),
  scheduledDates: z.array(z.object({
    roundNumber: z.number().int().min(1).max(3),
    date: z.string().describe('ISO date string (YYYY-MM-DD)'),
    time: z.string().describe('Time in HH:MM format')
  })).length(3).optional().describe('Optional: Custom schedule dates for all 3 rounds')
});

const GetCampaignScheduleSchema = z.object({
  campaignName: z.string().optional().describe('Filter by campaign name'),
  startDate: z.string().optional().describe('Start date for range query (YYYY-MM-DD)'),
  endDate: z.string().optional().describe('End date for range query (YYYY-MM-DD)'),
  status: z.enum([
    'SCHEDULED',
    'READY',
    'LAUNCHING',
    'SENT',
    'COMPLETED',
    'BLOCKED',
    'CANCELLED'
  ]).optional().describe('Filter by campaign status')
});

const GetUpcomingCampaignsSchema = z.object({
  days: z.number().int().default(30).describe('Number of days ahead to query (default: 30)'),
  includeMetrics: z.boolean().default(false).describe('Include delivery metrics for sent campaigns')
});

const UpdateCampaignScheduleSchema = z.object({
  scheduleId: z.number().int().describe('Campaign schedule ID'),
  scheduledDate: z.string().optional().describe('New scheduled date (YYYY-MM-DD)'),
  scheduledTime: z.string().optional().describe('New scheduled time (HH:MM)'),
  status: z.enum([
    'SCHEDULED',
    'READY',
    'LAUNCHING',
    'SENT',
    'COMPLETED',
    'BLOCKED',
    'CANCELLED'
  ]).optional().describe('Update campaign status')
});

const GetCampaignMetricsSchema = z.object({
  scheduleId: z.number().int().optional().describe('Specific schedule ID'),
  campaignName: z.string().optional().describe('Campaign name to get all rounds'),
  includeAIAnalysis: z.boolean().default(false).describe('Include AI-powered analysis')
});

const ImportMarketingScheduleSchema = z.object({
  schedule: z.array(z.object({
    name: z.string(),
    releaseDate: z.string(),
    theme: z.string(),
    keyMessages: z.array(z.string()),
    channels: z.array(z.string()),
    targetAudience: z.string(),
    successMetrics: z.array(z.string())
  })).describe('Array of marketing releases from Q4 2025 schedule')
});

const GetWeeklyScheduleSchema = z.object({
  weekOffset: z.number().int().default(0).describe('Weeks from now (0 = this week, 1 = next week, -1 = last week)')
});

const GetMonthlyViewSchema = z.object({
  month: z.number().int().min(1).max(12).optional().describe('Month number (1-12)'),
  year: z.number().int().optional().describe('Year (defaults to current year)')
});

const CancelCampaignSchema = z.object({
  scheduleId: z.number().int().describe('Campaign schedule ID to cancel'),
  reason: z.string().describe('Reason for cancellation'),
  notifyChannel: z.boolean().default(true).describe('Send cancellation notification to Slack')
});

// MCP Server implementation
const server = new Server(
  {
    name: 'lifecycle-campaign-manager',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions
const tools: Tool[] = [
  {
    name: 'create_lifecycle_campaign',
    description: 'Create a new 3-round lifecycle email campaign with automated scheduling. Each campaign sends to 3 segments over 3 weeks with full lifecycle notifications (Pre-Launch, Pre-Flight, Launch, Wrap-Up).',
    inputSchema: {
      type: 'object',
      properties: {
        campaignName: { type: 'string', description: 'Campaign name (e.g., "Client Letter Automation")' },
        listIdPrefix: { type: 'string', description: 'Prefix for MailJet list IDs' },
        subject: { type: 'string', description: 'Email subject with merge tags' },
        senderName: { type: 'string', description: 'Sender display name' },
        senderEmail: { type: 'string', description: 'Sender email address' },
        totalRecipients: { type: 'number', description: 'Total recipients across 3 rounds' },
        mailjetListIds: { type: 'array', items: { type: 'number' }, description: '3 MailJet list IDs' },
        mailjetTemplateId: { type: 'number', description: 'MailJet template ID' },
        notificationChannel: { type: 'string', description: 'Slack channel (e.g., "#_traction")' },
        scheduledDates: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              roundNumber: { type: 'number' },
              date: { type: 'string' },
              time: { type: 'string' }
            }
          },
          description: 'Optional: Custom dates for all 3 rounds'
        }
      },
      required: ['campaignName', 'listIdPrefix', 'subject', 'senderName', 'senderEmail', 'totalRecipients', 'mailjetListIds', 'mailjetTemplateId', 'notificationChannel']
    }
  },
  {
    name: 'get_campaign_schedule',
    description: 'Query campaign schedules with flexible filtering by name, date range, and status. Returns detailed schedule information for all matching campaigns.',
    inputSchema: {
      type: 'object',
      properties: {
        campaignName: { type: 'string', description: 'Filter by campaign name' },
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        status: { type: 'string', enum: ['SCHEDULED', 'READY', 'LAUNCHING', 'SENT', 'COMPLETED', 'BLOCKED', 'CANCELLED'] }
      }
    }
  },
  {
    name: 'get_upcoming_campaigns',
    description: 'Get all campaigns scheduled in the next N days (default 30). Perfect for visibility into upcoming sends and weekly planning.',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Days ahead to query (default: 30)' },
        includeMetrics: { type: 'boolean', description: 'Include delivery metrics' }
      }
    }
  },
  {
    name: 'get_weekly_schedule',
    description: 'Get campaign schedule for a specific week. Use weekOffset to look ahead (positive) or back (negative). Returns formatted weekly view.',
    inputSchema: {
      type: 'object',
      properties: {
        weekOffset: { type: 'number', description: '0=this week, 1=next week, -1=last week' }
      }
    }
  },
  {
    name: 'get_monthly_view',
    description: 'Get calendar view of all campaigns for a specific month. Shows all rounds scheduled in that month with status and metrics.',
    inputSchema: {
      type: 'object',
      properties: {
        month: { type: 'number', description: 'Month (1-12)' },
        year: { type: 'number', description: 'Year (defaults to current)' }
      }
    }
  },
  {
    name: 'update_campaign_schedule',
    description: 'Reschedule a campaign or update its status. Automatically manages Bull queue jobs when rescheduling.',
    inputSchema: {
      type: 'object',
      properties: {
        scheduleId: { type: 'number', description: 'Schedule ID to update' },
        scheduledDate: { type: 'string', description: 'New date (YYYY-MM-DD)' },
        scheduledTime: { type: 'string', description: 'New time (HH:MM)' },
        status: { type: 'string', enum: ['SCHEDULED', 'READY', 'LAUNCHING', 'SENT', 'COMPLETED', 'BLOCKED', 'CANCELLED'] }
      },
      required: ['scheduleId']
    }
  },
  {
    name: 'get_campaign_metrics',
    description: 'Retrieve delivery metrics and performance data for completed campaigns. Optionally include AI-powered analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        scheduleId: { type: 'number', description: 'Specific schedule ID' },
        campaignName: { type: 'string', description: 'Get metrics for all rounds' },
        includeAIAnalysis: { type: 'boolean', description: 'Include AI analysis' }
      }
    }
  },
  {
    name: 'cancel_campaign',
    description: 'Cancel a scheduled campaign. Removes Bull queue jobs and optionally sends Slack notification.',
    inputSchema: {
      type: 'object',
      properties: {
        scheduleId: { type: 'number', description: 'Schedule ID to cancel' },
        reason: { type: 'string', description: 'Cancellation reason' },
        notifyChannel: { type: 'boolean', description: 'Send Slack notification' }
      },
      required: ['scheduleId', 'reason']
    }
  },
  {
    name: 'import_marketing_schedule',
    description: 'Import Q4 2025 marketing schedule and create lifecycle campaigns for each release. Maps marketing releases to 3-round email campaigns.',
    inputSchema: {
      type: 'object',
      properties: {
        schedule: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              releaseDate: { type: 'string' },
              theme: { type: 'string' },
              keyMessages: { type: 'array', items: { type: 'string' } },
              channels: { type: 'array', items: { type: 'string' } },
              targetAudience: { type: 'string' },
              successMetrics: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      },
      required: ['schedule']
    }
  },
  {
    name: 'get_slack_channel_activity',
    description: 'Forecast #_traction channel activity based on scheduled campaigns. Shows when notifications will be posted.',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Days ahead to forecast' }
      }
    }
  }
];

// Register tool list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Register tool execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'create_lifecycle_campaign':
        return await handleCreateLifecycleCampaign(args);

      case 'get_campaign_schedule':
        return await handleGetCampaignSchedule(args);

      case 'get_upcoming_campaigns':
        return await handleGetUpcomingCampaigns(args);

      case 'get_weekly_schedule':
        return await handleGetWeeklySchedule(args);

      case 'get_monthly_view':
        return await handleGetMonthlyView(args);

      case 'update_campaign_schedule':
        return await handleUpdateCampaignSchedule(args);

      case 'get_campaign_metrics':
        return await handleGetCampaignMetrics(args);

      case 'cancel_campaign':
        return await handleCancelCampaign(args);

      case 'import_marketing_schedule':
        return await handleImportMarketingSchedule(args);

      case 'get_slack_channel_activity':
        return await handleGetSlackChannelActivity(args);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
});

// Tool handlers
async function handleCreateLifecycleCampaign(args: any) {
  const validated = CreateLifecycleCampaignSchema.parse(args);

  // Call orchestrator service via API or directly
  const response = await fetch(`${process.env.API_BASE_URL}/api/lifecycle/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validated)
  });

  const result = await response.json();

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(result, null, 2)
    }]
  };
}

async function handleGetCampaignSchedule(args: any) {
  const validated = GetCampaignScheduleSchema.parse(args);

  const where: any = {};

  if (validated.campaignName) {
    where.campaign_name = { contains: validated.campaignName, mode: 'insensitive' };
  }

  if (validated.startDate || validated.endDate) {
    where.scheduled_date = {};
    if (validated.startDate) where.scheduled_date.gte = new Date(validated.startDate);
    if (validated.endDate) where.scheduled_date.lte = new Date(validated.endDate);
  }

  if (validated.status) {
    where.status = validated.status;
  }

  const schedules = await prisma.lifecycleCampaignSchedule.findMany({
    where,
    orderBy: { scheduled_date: 'asc' }
  });

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        count: schedules.length,
        schedules: schedules.map(s => ({
          id: s.id,
          campaignName: s.campaign_name,
          roundNumber: s.round_number,
          scheduledDate: s.scheduled_date,
          scheduledTime: s.scheduled_time,
          status: s.status,
          recipientCount: s.recipient_count,
          mailjetCampaignId: s.mailjet_campaign_id
        }))
      }, null, 2)
    }]
  };
}

async function handleGetUpcomingCampaigns(args: any) {
  const validated = GetUpcomingCampaignsSchema.parse(args);

  const endDate = new Date();
  endDate.setDate(endDate.getDate() + validated.days);

  const schedules = await prisma.lifecycleCampaignSchedule.findMany({
    where: {
      scheduled_date: {
        gte: new Date(),
        lte: endDate
      },
      status: { in: ['SCHEDULED', 'READY'] }
    },
    orderBy: { scheduled_date: 'asc' }
  });

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        queryPeriod: `Next ${validated.days} days`,
        count: schedules.length,
        campaigns: schedules.map(s => ({
          id: s.id,
          campaignName: s.campaign_name,
          roundNumber: s.round_number,
          scheduledDate: s.scheduled_date.toISOString().split('T')[0],
          scheduledTime: s.scheduled_time,
          status: s.status,
          recipientCount: s.recipient_count,
          daysUntil: Math.ceil((s.scheduled_date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        }))
      }, null, 2)
    }]
  };
}

async function handleGetWeeklySchedule(args: any) {
  const validated = GetWeeklyScheduleSchema.parse(args);

  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + (validated.weekOffset * 7));

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const schedules = await prisma.lifecycleCampaignSchedule.findMany({
    where: {
      scheduled_date: {
        gte: startOfWeek,
        lte: endOfWeek
      }
    },
    orderBy: [
      { scheduled_date: 'asc' },
      { scheduled_time: 'asc' }
    ]
  });

  // Group by day
  const byDay: Record<string, any[]> = {};
  schedules.forEach(s => {
    const day = s.scheduled_date.toISOString().split('T')[0];
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push({
      campaignName: s.campaign_name,
      roundNumber: s.round_number,
      time: s.scheduled_time,
      status: s.status,
      recipients: s.recipient_count
    });
  });

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        week: `${startOfWeek.toISOString().split('T')[0]} to ${endOfWeek.toISOString().split('T')[0]}`,
        totalCampaigns: schedules.length,
        schedule: byDay
      }, null, 2)
    }]
  };
}

async function handleGetMonthlyView(args: any) {
  const validated = GetMonthlyViewSchema.parse(args);

  const now = new Date();
  const year = validated.year || now.getFullYear();
  const month = validated.month || (now.getMonth() + 1);

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const schedules = await prisma.lifecycleCampaignSchedule.findMany({
    where: {
      scheduled_date: {
        gte: startDate,
        lte: endDate
      }
    },
    orderBy: { scheduled_date: 'asc' }
  });

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        month: `${year}-${String(month).padStart(2, '0')}`,
        totalCampaigns: schedules.length,
        campaigns: schedules.map(s => ({
          date: s.scheduled_date.toISOString().split('T')[0],
          campaignName: s.campaign_name,
          roundNumber: s.round_number,
          time: s.scheduled_time,
          status: s.status,
          recipients: s.recipient_count
        }))
      }, null, 2)
    }]
  };
}

async function handleUpdateCampaignSchedule(args: any) {
  const validated = UpdateCampaignScheduleSchema.parse(args);

  const data: any = {};
  if (validated.scheduledDate) data.scheduled_date = new Date(validated.scheduledDate);
  if (validated.scheduledTime) data.scheduled_time = validated.scheduledTime;
  if (validated.status) data.status = validated.status;

  const updated = await prisma.lifecycleCampaignSchedule.update({
    where: { id: validated.scheduleId },
    data
  });

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        scheduleId: updated.id,
        campaignName: updated.campaign_name,
        roundNumber: updated.round_number,
        updatedFields: data
      }, null, 2)
    }]
  };
}

async function handleGetCampaignMetrics(args: any) {
  const validated = GetCampaignMetricsSchema.parse(args);

  if (validated.scheduleId) {
    const metrics = await prisma.lifecycleCampaignMetrics.findMany({
      where: { campaign_schedule_id: validated.scheduleId }
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ metrics }, null, 2)
      }]
    };
  }

  if (validated.campaignName) {
    const schedules = await prisma.lifecycleCampaignSchedule.findMany({
      where: { campaign_name: validated.campaignName },
      include: { metrics: true }
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          campaignName: validated.campaignName,
          rounds: schedules.map(s => ({
            roundNumber: s.round_number,
            status: s.status,
            metrics: s.metrics
          }))
        }, null, 2)
      }]
    };
  }

  throw new Error('Must provide either scheduleId or campaignName');
}

async function handleCancelCampaign(args: any) {
  const validated = CancelCampaignSchema.parse(args);

  const updated = await prisma.lifecycleCampaignSchedule.update({
    where: { id: validated.scheduleId },
    data: {
      status: CampaignStatus.CANCELLED,
      cancellation_reason: validated.reason
    }
  });

  // TODO: Cancel Bull queue jobs
  // TODO: Send Slack notification if requested

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        scheduleId: updated.id,
        campaignName: updated.campaign_name,
        roundNumber: updated.round_number,
        status: 'CANCELLED',
        reason: validated.reason
      }, null, 2)
    }]
  };
}

async function handleImportMarketingSchedule(args: any) {
  const validated = ImportMarketingScheduleSchema.parse(args);

  // This would create campaigns for each marketing release
  // For now, return a plan
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        message: 'Marketing schedule import ready',
        releases: validated.schedule.length,
        campaignsToCreate: validated.schedule.map(r => ({
          name: r.name,
          releaseDate: r.releaseDate,
          rounds: 3,
          theme: r.theme
        }))
      }, null, 2)
    }]
  };
}

async function handleGetSlackChannelActivity(args: any) {
  const days = args?.days || 14;

  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);

  const schedules = await prisma.lifecycleCampaignSchedule.findMany({
    where: {
      scheduled_date: {
        gte: new Date(),
        lte: endDate
      },
      status: { in: ['SCHEDULED', 'READY'] }
    },
    orderBy: { scheduled_date: 'asc' }
  });

  // Each campaign = 5 notifications (Pre-Launch, Pre-Flight, Warning, Launch, Wrap-Up)
  const forecast = schedules.map(s => {
    const launchDate = new Date(s.scheduled_date);
    launchDate.setHours(parseInt(s.scheduled_time.split(':')[0]));

    const preLaunch = new Date(launchDate);
    preLaunch.setDate(launchDate.getDate() - 1);

    return {
      campaignName: s.campaign_name,
      roundNumber: s.round_number,
      notifications: [
        { type: 'Pre-Launch', time: preLaunch.toISOString() },
        { type: 'Pre-Flight', time: new Date(launchDate.getTime() - 3600000).toISOString() },
        { type: 'Launch Warning', time: new Date(launchDate.getTime() - 300000).toISOString() },
        { type: 'Launch', time: launchDate.toISOString() },
        { type: 'Wrap-Up', time: new Date(launchDate.getTime() + 1800000).toISOString() }
      ]
    };
  });

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        forecastPeriod: `Next ${days} days`,
        totalCampaigns: schedules.length,
        totalNotifications: schedules.length * 5,
        channelActivity: forecast
      }, null, 2)
    }]
  };
}

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Lifecycle Campaign MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
