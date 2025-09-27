import { SlackManagerClient } from './slack-manager-client';
import { MarketingAgentClient } from './marketing-agent-client';
import { MailjetAgentClient } from './mailjet-agent-client';
import { logger } from '@/utils/logger';
import { Campaign, Task, Approval } from '@/types';

export class CampaignOrchestrator {
  private slackClient: SlackManagerClient;
  private marketingClient: MarketingAgentClient;
  private mailjetClient: MailjetAgentClient;

  constructor() {
    this.slackClient = new SlackManagerClient();
    this.marketingClient = new MarketingAgentClient();
    this.mailjetClient = new MailjetAgentClient();
  }

  async initialize(): Promise<void> {
    logger.info('Initializing MCP client connections');

    const connections = await Promise.allSettled([
      this.slackClient.testConnection(),
      this.marketingClient.testConnection(),
      this.mailjetClient.testConnection()
    ]);

    connections.forEach((result, index) => {
      const serviceName = ['Slack Manager', 'Marketing Agent', 'Mailjet Agent'][index];
      if (result.status === 'fulfilled' && result.value) {
        logger.info(`${serviceName} connection successful`);
      } else {
        logger.warn(`${serviceName} connection failed`);
      }
    });
  }

  // Orchestrated Campaign Launch
  async launchEmailCampaign(
    campaign: Campaign,
    emailContent: {
      subject: string;
      htmlContent: string;
      textContent?: string;
    },
    contactEmails: string[],
    options?: {
      scheduledFor?: Date;
      notifyTeam?: boolean;
      trackPerformance?: boolean;
    }
  ): Promise<{
    success: boolean;
    emailCampaignId?: string;
    errors: string[];
  }> {
    const errors: string[] = [];
    let emailCampaignId: string | undefined;

    try {
      logger.info('Orchestrating email campaign launch', { campaignId: campaign.id });

      // Step 1: Launch email campaign via Mailjet
      try {
        const emailResult = await this.mailjetClient.launchEmailCampaign(
          campaign.name,
          emailContent.subject,
          emailContent.htmlContent,
          contactEmails,
          options?.scheduledFor
        );
        emailCampaignId = emailResult.campaign.id;
        logger.info('Email campaign created', { emailCampaignId });
      } catch (error) {
        errors.push('Failed to create email campaign');
        logger.error('Email campaign creation failed', error);
      }

      // Step 2: Notify team via Slack
      if (options?.notifyTeam !== false && emailCampaignId) {
        try {
          await this.slackClient.notifyCampaignUpdate(
            campaign,
            options?.scheduledFor ? 'scheduled' : 'launched'
          );
          logger.info('Team notified via Slack');
        } catch (error) {
          errors.push('Failed to notify team');
          logger.warn('Slack notification failed', error);
        }
      }

      // Step 3: Set up performance tracking
      if (options?.trackPerformance !== false && emailCampaignId) {
        try {
          await this.marketingClient.trackCampaignPerformance(
            campaign.id,
            {
              impressions: contactEmails.length,
              clicks: 0,
              conversions: 0
            }
          );
          logger.info('Performance tracking initialized');
        } catch (error) {
          errors.push('Failed to initialize tracking');
          logger.warn('Performance tracking setup failed', error);
        }
      }

      return {
        success: !!emailCampaignId,
        emailCampaignId,
        errors
      };

    } catch (error) {
      logger.error('Campaign launch orchestration failed', error);
      return {
        success: false,
        errors: [...errors, 'Orchestration failed']
      };
    }
  }

  // Sync Campaign Performance
  async syncCampaignPerformance(
    campaignId: string,
    mailjetCampaignId?: string
  ): Promise<{
    emailStats?: any;
    marketingMetrics?: any;
    errors: string[];
  }> {
    const errors: string[] = [];
    let emailStats, marketingMetrics;

    // Get email statistics from Mailjet
    if (mailjetCampaignId) {
      try {
        emailStats = await this.mailjetClient.getEmailStatistics(mailjetCampaignId);

        // Sync to Marketing Agent
        if (emailStats) {
          await this.marketingClient.syncEmailStatistics(campaignId, mailjetCampaignId);
        }
      } catch (error) {
        errors.push('Failed to sync email statistics');
        logger.error('Email stats sync failed', error);
      }
    }

    // Get overall marketing metrics
    try {
      marketingMetrics = await this.marketingClient.syncCampaignResults(
        campaignId,
        'Campaign',
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        new Date()
      );
    } catch (error) {
      errors.push('Failed to get marketing metrics');
      logger.error('Marketing metrics sync failed', error);
    }

    return {
      emailStats,
      marketingMetrics,
      errors
    };
  }

  // Handle Task Assignment with Notifications
  async assignTaskWithNotification(
    task: Task,
    assigneeName: string,
    assigneeEmail?: string,
    assigneeSlackUsername?: string
  ): Promise<{
    notificationsSent: string[];
    errors: string[];
  }> {
    const notificationsSent: string[] = [];
    const errors: string[] = [];

    // Send Slack notification
    if (assigneeSlackUsername) {
      try {
        const sent = await this.slackClient.notifyTaskAssignment(
          task,
          assigneeName,
          assigneeSlackUsername
        );
        if (sent) {
          notificationsSent.push('slack');
        }
      } catch (error) {
        errors.push('Failed to send Slack notification');
        logger.error('Slack task notification failed', error);
      }
    }

    // Send email notification
    if (assigneeEmail) {
      try {
        const emailContent = this.generateTaskEmailContent(task, assigneeName);
        await this.mailjetClient.sendTransactionalEmail(
          assigneeEmail,
          `New Task Assigned: ${task.title}`,
          emailContent.html,
          emailContent.text
        );
        notificationsSent.push('email');
      } catch (error) {
        errors.push('Failed to send email notification');
        logger.error('Email task notification failed', error);
      }
    }

    return {
      notificationsSent,
      errors
    };
  }

  // Handle Approval Request with Notifications
  async requestApprovalWithNotification(
    approval: Approval,
    campaignName: string,
    approverEmail?: string,
    approverSlackUsername?: string
  ): Promise<{
    notificationsSent: string[];
    errors: string[];
  }> {
    const notificationsSent: string[] = [];
    const errors: string[] = [];

    // Send Slack notification with interactive buttons
    if (approverSlackUsername) {
      try {
        const sent = await this.slackClient.notifyApprovalRequest(
          approval,
          campaignName,
          approverSlackUsername
        );
        if (sent) {
          notificationsSent.push('slack');
        }
      } catch (error) {
        errors.push('Failed to send Slack approval request');
        logger.error('Slack approval notification failed', error);
      }
    }

    // Send email notification
    if (approverEmail) {
      try {
        const emailContent = this.generateApprovalEmailContent(approval, campaignName);
        await this.mailjetClient.sendTransactionalEmail(
          approverEmail,
          `Approval Required: ${campaignName}`,
          emailContent.html,
          emailContent.text
        );
        notificationsSent.push('email');
      } catch (error) {
        errors.push('Failed to send email approval request');
        logger.error('Email approval notification failed', error);
      }
    }

    return {
      notificationsSent,
      errors
    };
  }

  // Send Daily Digests
  async sendDailyDigests(
    recipients: Array<{
      email: string;
      slackUsername?: string;
      stats: {
        activeCampaigns: number;
        pendingTasks: number;
        overdueItems: number;
        todayDeadlines: number;
        pendingApprovals: number;
      };
    }>
  ): Promise<{
    sent: number;
    failed: number;
  }> {
    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      try {
        // Send via Slack if available
        if (recipient.slackUsername) {
          await this.slackClient.sendDailyDigest(
            recipient.slackUsername,
            recipient.stats
          );
        }

        // Send via email
        const emailContent = this.generateDigestEmailContent(recipient.stats);
        await this.mailjetClient.sendTransactionalEmail(
          recipient.email,
          `Daily Campaign Digest - ${new Date().toLocaleDateString()}`,
          emailContent.html,
          emailContent.text
        );

        sent++;
      } catch (error) {
        failed++;
        logger.error('Failed to send daily digest', { recipient: recipient.email, error });
      }
    }

    return { sent, failed };
  }

  // Generate Campaign Report
  async generateComprehensiveCampaignReport(
    campaignId: string,
    campaignName: string,
    mailjetCampaignId?: string
  ): Promise<{
    summary: string;
    emailPerformance?: any;
    marketingMetrics?: any;
    recommendations: string[];
  }> {
    const recommendations: string[] = [];
    let emailPerformance, marketingMetrics;

    // Get email performance if available
    if (mailjetCampaignId) {
      try {
        emailPerformance = await this.mailjetClient.getEmailCampaignReport(mailjetCampaignId);
        recommendations.push(...(emailPerformance.recommendations || []));
      } catch (error) {
        logger.warn('Could not fetch email performance', error);
      }
    }

    // Get marketing metrics
    try {
      const report = await this.marketingClient.generateCampaignReport(campaignId);
      marketingMetrics = report.metrics;
      recommendations.push(...(report.recommendations || []));
    } catch (error) {
      logger.warn('Could not fetch marketing metrics', error);
    }

    // Generate summary
    const summary = this.generateReportSummary(
      campaignName,
      emailPerformance,
      marketingMetrics
    );

    return {
      summary,
      emailPerformance,
      marketingMetrics,
      recommendations: [...new Set(recommendations)] // Remove duplicates
    };
  }

  // Private helper methods

  private generateTaskEmailContent(task: Task, assigneeName: string): {
    html: string;
    text: string;
  } {
    const html = `
      <h2>New Task Assigned</h2>
      <p>Hi ${assigneeName},</p>
      <p>You have been assigned a new task:</p>
      <h3>${task.title}</h3>
      ${task.description ? `<p>${task.description}</p>` : ''}
      <ul>
        <li><strong>Due Date:</strong> ${new Date(task.dueDate).toLocaleDateString()}</li>
        <li><strong>Priority:</strong> ${task.priority}</li>
        <li><strong>Estimated Hours:</strong> ${task.estimatedHours}</li>
      </ul>
      <p><a href="${process.env.APP_URL}/tasks/${task.id}">View Task</a></p>
    `;

    const text = `
New Task Assigned

Hi ${assigneeName},

You have been assigned: ${task.title}

${task.description || ''}

Due Date: ${new Date(task.dueDate).toLocaleDateString()}
Priority: ${task.priority}
Estimated Hours: ${task.estimatedHours}

View task: ${process.env.APP_URL}/tasks/${task.id}
    `;

    return { html, text };
  }

  private generateApprovalEmailContent(approval: Approval, campaignName: string): {
    html: string;
    text: string;
  } {
    const html = `
      <h2>Approval Required</h2>
      <p>Campaign <strong>${campaignName}</strong> requires your approval.</p>
      <ul>
        <li><strong>Stage:</strong> ${approval.stage}</li>
        <li><strong>Urgency:</strong> ${approval.urgency}</li>
        <li><strong>Due Date:</strong> ${approval.dueDate ? new Date(approval.dueDate).toLocaleDateString() : 'N/A'}</li>
      </ul>
      <p>
        <a href="${process.env.APP_URL}/approvals/${approval.id}/approve"
           style="background: green; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
          Approve
        </a>
        <a href="${process.env.APP_URL}/approvals/${approval.id}/reject"
           style="background: red; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-left: 10px;">
          Reject
        </a>
      </p>
    `;

    const text = `
Approval Required

Campaign: ${campaignName}
Stage: ${approval.stage}
Urgency: ${approval.urgency}
Due Date: ${approval.dueDate ? new Date(approval.dueDate).toLocaleDateString() : 'N/A'}

Approve: ${process.env.APP_URL}/approvals/${approval.id}/approve
Reject: ${process.env.APP_URL}/approvals/${approval.id}/reject
    `;

    return { html, text };
  }

  private generateDigestEmailContent(stats: any): {
    html: string;
    text: string;
  } {
    const html = `
      <h2>Daily Campaign Manager Digest</h2>
      <p>Here's your campaign overview for ${new Date().toLocaleDateString()}:</p>
      <ul>
        <li>Active Campaigns: ${stats.activeCampaigns}</li>
        <li>Pending Tasks: ${stats.pendingTasks}</li>
        <li>Today's Deadlines: ${stats.todayDeadlines}</li>
        <li>Pending Approvals: ${stats.pendingApprovals}</li>
      </ul>
      ${stats.overdueItems > 0 ? `<p><strong>⚠️ You have ${stats.overdueItems} overdue items!</strong></p>` : ''}
      <p><a href="${process.env.APP_URL}/dashboard">View Dashboard</a></p>
    `;

    const text = `
Daily Campaign Digest - ${new Date().toLocaleDateString()}

Active Campaigns: ${stats.activeCampaigns}
Pending Tasks: ${stats.pendingTasks}
Today's Deadlines: ${stats.todayDeadlines}
Pending Approvals: ${stats.pendingApprovals}

${stats.overdueItems > 0 ? `⚠️ You have ${stats.overdueItems} overdue items!` : ''}

View Dashboard: ${process.env.APP_URL}/dashboard
    `;

    return { html, text };
  }

  private generateReportSummary(
    campaignName: string,
    emailPerformance?: any,
    marketingMetrics?: any
  ): string {
    let summary = `Campaign "${campaignName}" Report:\n`;

    if (emailPerformance?.statistics) {
      const stats = emailPerformance.statistics;
      summary += `\nEmail Performance:
- Sent: ${stats.sent}
- Open Rate: ${stats.openRate.toFixed(1)}%
- Click Rate: ${stats.clickRate.toFixed(1)}%\n`;
    }

    if (marketingMetrics) {
      summary += `\nMarketing Metrics:
- Conversions: ${marketingMetrics.conversions}
- ROI: ${marketingMetrics.roi.toFixed(0)}%
- Cost per Acquisition: $${marketingMetrics.costPerClick.toFixed(2)}\n`;
    }

    return summary;
  }
}