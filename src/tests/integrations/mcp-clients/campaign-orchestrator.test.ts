import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CampaignOrchestrator } from '@/integrations/mcp-clients/campaign-orchestrator';
import { SlackManagerClient } from '@/integrations/mcp-clients/slack-manager-client';
import { MarketingAgentClient } from '@/integrations/mcp-clients/marketing-agent-client';
import { MailjetAgentClient } from '@/integrations/mcp-clients/mailjet-agent-client';
import { Campaign, Task, Approval } from '@/types';

// Mock MCP clients
vi.mock('@/integrations/mcp-clients/slack-manager-client');
vi.mock('@/integrations/mcp-clients/marketing-agent-client');
vi.mock('@/integrations/mcp-clients/mailjet-agent-client');

const mockSlackClient = {
  testConnection: vi.fn(),
  notifyCampaignUpdate: vi.fn(),
  notifyTaskAssignment: vi.fn(),
  notifyApprovalRequest: vi.fn(),
  sendDailyDigest: vi.fn()
};

const mockMarketingClient = {
  testConnection: vi.fn(),
  trackCampaignPerformance: vi.fn(),
  syncEmailStatistics: vi.fn(),
  syncCampaignResults: vi.fn(),
  generateCampaignReport: vi.fn()
};

const mockMailjetClient = {
  testConnection: vi.fn(),
  launchEmailCampaign: vi.fn(),
  getEmailStatistics: vi.fn(),
  sendTransactionalEmail: vi.fn(),
  getEmailCampaignReport: vi.fn()
};

describe('CampaignOrchestrator', () => {
  let orchestrator: CampaignOrchestrator;

  beforeEach(() => {
    vi.clearAllMocks();

    (SlackManagerClient as any).mockImplementation(() => mockSlackClient);
    (MarketingAgentClient as any).mockImplementation(() => mockMarketingClient);
    (MailjetAgentClient as any).mockImplementation(() => mockMailjetClient);

    orchestrator = new CampaignOrchestrator();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('initialize', () => {
    it('should initialize all MCP client connections', async () => {
      mockSlackClient.testConnection.mockResolvedValue(true);
      mockMarketingClient.testConnection.mockResolvedValue(true);
      mockMailjetClient.testConnection.mockResolvedValue(true);

      await orchestrator.initialize();

      expect(mockSlackClient.testConnection).toHaveBeenCalled();
      expect(mockMarketingClient.testConnection).toHaveBeenCalled();
      expect(mockMailjetClient.testConnection).toHaveBeenCalled();
    });

    it('should handle connection failures gracefully', async () => {
      mockSlackClient.testConnection.mockResolvedValue(false);
      mockMarketingClient.testConnection.mockRejectedValue(new Error('Connection failed'));
      mockMailjetClient.testConnection.mockResolvedValue(true);

      // Should not throw
      await expect(orchestrator.initialize()).resolves.not.toThrow();
    });
  });

  describe('launchEmailCampaign', () => {
    const mockCampaign: Campaign = {
      id: 'campaign-1',
      name: 'Test Campaign',
      description: 'Test description',
      status: 'draft',
      priority: 'medium',
      assigneeEmail: 'user@example.com',
      createdBy: 'creator@example.com',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const emailContent = {
      subject: 'Test Email',
      htmlContent: '<h1>Test Content</h1>',
      textContent: 'Test Content'
    };

    const contactEmails = ['contact1@example.com', 'contact2@example.com'];

    it('should successfully launch email campaign with all steps', async () => {
      const options = {
        scheduledFor: new Date('2024-12-01'),
        notifyTeam: true,
        trackPerformance: true
      };

      const mockEmailResult = {
        campaign: { id: 'email-campaign-1' },
        template: { id: 'template-1' },
        contactList: { id: 'list-1' }
      };

      mockMailjetClient.launchEmailCampaign.mockResolvedValue(mockEmailResult);
      mockSlackClient.notifyCampaignUpdate.mockResolvedValue(true);
      mockMarketingClient.trackCampaignPerformance.mockResolvedValue(true);

      const result = await orchestrator.launchEmailCampaign(
        mockCampaign,
        emailContent,
        contactEmails,
        options
      );

      expect(mockMailjetClient.launchEmailCampaign).toHaveBeenCalledWith(
        'Test Campaign',
        'Test Email',
        '<h1>Test Content</h1>',
        contactEmails,
        options.scheduledFor
      );

      expect(mockSlackClient.notifyCampaignUpdate).toHaveBeenCalledWith(
        mockCampaign,
        'scheduled'
      );

      expect(mockMarketingClient.trackCampaignPerformance).toHaveBeenCalledWith(
        'campaign-1',
        {
          impressions: 2,
          clicks: 0,
          conversions: 0
        }
      );

      expect(result).toEqual({
        success: true,
        emailCampaignId: 'email-campaign-1',
        errors: []
      });
    });

    it('should launch immediately when not scheduled', async () => {
      const options = {
        notifyTeam: true,
        trackPerformance: true
      };

      const mockEmailResult = {
        campaign: { id: 'email-campaign-2' }
      };

      mockMailjetClient.launchEmailCampaign.mockResolvedValue(mockEmailResult);
      mockSlackClient.notifyCampaignUpdate.mockResolvedValue(true);
      mockMarketingClient.trackCampaignPerformance.mockResolvedValue(true);

      const result = await orchestrator.launchEmailCampaign(
        mockCampaign,
        emailContent,
        contactEmails,
        options
      );

      expect(mockSlackClient.notifyCampaignUpdate).toHaveBeenCalledWith(
        mockCampaign,
        'launched'
      );

      expect(result.success).toBe(true);
      expect(result.emailCampaignId).toBe('email-campaign-2');
    });

    it('should handle email campaign creation failure', async () => {
      mockMailjetClient.launchEmailCampaign.mockRejectedValue(new Error('Mailjet API error'));

      const result = await orchestrator.launchEmailCampaign(
        mockCampaign,
        emailContent,
        contactEmails
      );

      expect(result).toEqual({
        success: false,
        emailCampaignId: undefined,
        errors: ['Failed to create email campaign']
      });
    });

    it('should continue with partial failures', async () => {
      const mockEmailResult = {
        campaign: { id: 'email-campaign-3' }
      };

      mockMailjetClient.launchEmailCampaign.mockResolvedValue(mockEmailResult);
      mockSlackClient.notifyCampaignUpdate.mockRejectedValue(new Error('Slack API error'));
      mockMarketingClient.trackCampaignPerformance.mockRejectedValue(new Error('Marketing API error'));

      const result = await orchestrator.launchEmailCampaign(
        mockCampaign,
        emailContent,
        contactEmails,
        { notifyTeam: true, trackPerformance: true }
      );

      expect(result).toEqual({
        success: true,
        emailCampaignId: 'email-campaign-3',
        errors: ['Failed to notify team', 'Failed to initialize tracking']
      });
    });

    it('should skip optional steps when disabled', async () => {
      const mockEmailResult = {
        campaign: { id: 'email-campaign-4' }
      };

      mockMailjetClient.launchEmailCampaign.mockResolvedValue(mockEmailResult);

      const result = await orchestrator.launchEmailCampaign(
        mockCampaign,
        emailContent,
        contactEmails,
        { notifyTeam: false, trackPerformance: false }
      );

      expect(mockSlackClient.notifyCampaignUpdate).not.toHaveBeenCalled();
      expect(mockMarketingClient.trackCampaignPerformance).not.toHaveBeenCalled();

      expect(result).toEqual({
        success: true,
        emailCampaignId: 'email-campaign-4',
        errors: []
      });
    });
  });

  describe('syncCampaignPerformance', () => {
    it('should sync email statistics and marketing metrics', async () => {
      const campaignId = 'campaign-1';
      const mailjetCampaignId = 'email-campaign-1';

      const mockEmailStats = {
        campaignId: mailjetCampaignId,
        sent: 1000,
        delivered: 950,
        opened: 400,
        clicked: 80,
        bounced: 50,
        openRate: 42.1,
        clickRate: 8.4
      };

      const mockMarketingMetrics = {
        metrics: {
          impressions: 1000,
          clicks: 80,
          conversions: 15,
          conversionRate: 1.5
        }
      };

      mockMailjetClient.getEmailStatistics.mockResolvedValue(mockEmailStats);
      mockMarketingClient.syncEmailStatistics.mockResolvedValue(true);
      mockMarketingClient.syncCampaignResults.mockResolvedValue(mockMarketingMetrics);

      const result = await orchestrator.syncCampaignPerformance(campaignId, mailjetCampaignId);

      expect(mockMailjetClient.getEmailStatistics).toHaveBeenCalledWith(mailjetCampaignId);
      expect(mockMarketingClient.syncEmailStatistics).toHaveBeenCalledWith(campaignId, mailjetCampaignId);
      expect(mockMarketingClient.syncCampaignResults).toHaveBeenCalledWith(
        campaignId,
        'Campaign',
        expect.any(Date),
        expect.any(Date)
      );

      expect(result).toEqual({
        emailStats: mockEmailStats,
        marketingMetrics: mockMarketingMetrics,
        errors: []
      });
    });

    it('should handle missing mailjet campaign ID', async () => {
      const campaignId = 'campaign-1';

      const mockMarketingMetrics = {
        metrics: { impressions: 0, clicks: 0, conversions: 0 }
      };

      mockMarketingClient.syncCampaignResults.mockResolvedValue(mockMarketingMetrics);

      const result = await orchestrator.syncCampaignPerformance(campaignId);

      expect(mockMailjetClient.getEmailStatistics).not.toHaveBeenCalled();
      expect(mockMarketingClient.syncCampaignResults).toHaveBeenCalled();

      expect(result).toEqual({
        emailStats: undefined,
        marketingMetrics: mockMarketingMetrics,
        errors: []
      });
    });

    it('should handle sync failures gracefully', async () => {
      const campaignId = 'campaign-1';
      const mailjetCampaignId = 'email-campaign-1';

      mockMailjetClient.getEmailStatistics.mockRejectedValue(new Error('Email stats error'));
      mockMarketingClient.syncCampaignResults.mockRejectedValue(new Error('Marketing sync error'));

      const result = await orchestrator.syncCampaignPerformance(campaignId, mailjetCampaignId);

      expect(result).toEqual({
        emailStats: undefined,
        marketingMetrics: undefined,
        errors: ['Failed to sync email statistics', 'Failed to get marketing metrics']
      });
    });
  });

  describe('assignTaskWithNotification', () => {
    const mockTask: Task = {
      id: 'task-1',
      title: 'Test Task',
      description: 'Task description',
      status: 'pending',
      priority: 'medium',
      dueDate: new Date(),
      assigneeEmail: 'assignee@example.com',
      campaignId: 'campaign-1',
      createdBy: 'creator@example.com',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should send both Slack and email notifications', async () => {
      mockSlackClient.notifyTaskAssignment.mockResolvedValue(true);
      mockMailjetClient.sendTransactionalEmail.mockResolvedValue({
        messageId: 'msg-1',
        success: true
      });

      const result = await orchestrator.assignTaskWithNotification(
        mockTask,
        'John Doe',
        'john@example.com',
        'john.doe'
      );

      expect(mockSlackClient.notifyTaskAssignment).toHaveBeenCalledWith(
        mockTask,
        'John Doe',
        'john.doe'
      );

      expect(mockMailjetClient.sendTransactionalEmail).toHaveBeenCalledWith(
        'john@example.com',
        'New Task Assigned: Test Task',
        expect.stringContaining('<h2>New Task Assigned</h2>'),
        expect.stringContaining('New Task Assigned')
      );

      expect(result).toEqual({
        notificationsSent: ['slack', 'email'],
        errors: []
      });
    });

    it('should handle partial notification failures', async () => {
      mockSlackClient.notifyTaskAssignment.mockRejectedValue(new Error('Slack error'));
      mockMailjetClient.sendTransactionalEmail.mockResolvedValue({
        messageId: 'msg-1',
        success: true
      });

      const result = await orchestrator.assignTaskWithNotification(
        mockTask,
        'John Doe',
        'john@example.com',
        'john.doe'
      );

      expect(result).toEqual({
        notificationsSent: ['email'],
        errors: ['Failed to send Slack notification']
      });
    });

    it('should handle missing contact information', async () => {
      const result = await orchestrator.assignTaskWithNotification(
        mockTask,
        'John Doe'
      );

      expect(mockSlackClient.notifyTaskAssignment).not.toHaveBeenCalled();
      expect(mockMailjetClient.sendTransactionalEmail).not.toHaveBeenCalled();

      expect(result).toEqual({
        notificationsSent: [],
        errors: []
      });
    });
  });

  describe('requestApprovalWithNotification', () => {
    const mockApproval: Approval = {
      id: 'approval-1',
      stage: 'Final Review',
      status: 'pending',
      urgency: 'high',
      approverEmail: 'approver@example.com',
      campaignId: 'campaign-1',
      createdBy: 'creator@example.com',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should send approval request notifications', async () => {
      mockSlackClient.notifyApprovalRequest.mockResolvedValue(true);
      mockMailjetClient.sendTransactionalEmail.mockResolvedValue({
        messageId: 'msg-2',
        success: true
      });

      const result = await orchestrator.requestApprovalWithNotification(
        mockApproval,
        'Test Campaign',
        'approver@example.com',
        'approver.user'
      );

      expect(mockSlackClient.notifyApprovalRequest).toHaveBeenCalledWith(
        mockApproval,
        'Test Campaign',
        'approver.user'
      );

      expect(mockMailjetClient.sendTransactionalEmail).toHaveBeenCalledWith(
        'approver@example.com',
        'Approval Required: Test Campaign',
        expect.stringContaining('<h2>Approval Required</h2>'),
        expect.stringContaining('Approval Required')
      );

      expect(result).toEqual({
        notificationsSent: ['slack', 'email'],
        errors: []
      });
    });
  });

  describe('sendDailyDigests', () => {
    const mockRecipients = [
      {
        email: 'user1@example.com',
        slackUsername: 'user1',
        stats: {
          activeCampaigns: 5,
          pendingTasks: 8,
          overdueItems: 2,
          todayDeadlines: 3,
          pendingApprovals: 1
        }
      },
      {
        email: 'user2@example.com',
        stats: {
          activeCampaigns: 3,
          pendingTasks: 5,
          overdueItems: 0,
          todayDeadlines: 1,
          pendingApprovals: 2
        }
      }
    ];

    it('should send daily digests to all recipients', async () => {
      mockSlackClient.sendDailyDigest.mockResolvedValue(true);
      mockMailjetClient.sendTransactionalEmail
        .mockResolvedValueOnce({ messageId: 'msg-3', success: true })
        .mockResolvedValueOnce({ messageId: 'msg-4', success: true });

      const result = await orchestrator.sendDailyDigests(mockRecipients);

      expect(mockSlackClient.sendDailyDigest).toHaveBeenCalledTimes(1); // Only user1 has Slack
      expect(mockMailjetClient.sendTransactionalEmail).toHaveBeenCalledTimes(2);

      expect(result).toEqual({
        sent: 2,
        failed: 0
      });
    });

    it('should handle digest sending failures', async () => {
      mockSlackClient.sendDailyDigest.mockRejectedValue(new Error('Slack error'));
      mockMailjetClient.sendTransactionalEmail
        .mockResolvedValueOnce({ messageId: 'msg-3', success: true })
        .mockRejectedValueOnce(new Error('Email error'));

      const result = await orchestrator.sendDailyDigests(mockRecipients);

      expect(result).toEqual({
        sent: 1,
        failed: 1
      });
    });
  });

  describe('generateComprehensiveCampaignReport', () => {
    it('should generate comprehensive report with all metrics', async () => {
      const campaignId = 'campaign-1';
      const campaignName = 'Test Campaign';
      const mailjetCampaignId = 'email-campaign-1';

      const mockEmailReport = {
        statistics: {
          sent: 1000,
          openRate: 25.5,
          clickRate: 3.2
        },
        recommendations: ['Improve subject line', 'Test send times']
      };

      const mockMarketingReport = {
        metrics: {
          conversions: 45,
          roi: 250,
          costPerClick: 1.25
        },
        recommendations: ['Increase budget', 'Target different audience']
      };

      mockMailjetClient.getEmailCampaignReport.mockResolvedValue(mockEmailReport);
      mockMarketingClient.generateCampaignReport.mockResolvedValue(mockMarketingReport);

      const result = await orchestrator.generateComprehensiveCampaignReport(
        campaignId,
        campaignName,
        mailjetCampaignId
      );

      expect(result.summary).toContain('Test Campaign');
      expect(result.summary).toContain('25.5%');
      expect(result.summary).toContain('3.2%');
      expect(result.summary).toContain('45');
      expect(result.summary).toContain('250%');

      expect(result.emailPerformance).toEqual(mockEmailReport);
      expect(result.marketingMetrics).toEqual(mockMarketingReport.metrics);
      expect(result.recommendations).toEqual([
        'Improve subject line',
        'Test send times',
        'Increase budget',
        'Target different audience'
      ]);
    });

    it('should handle missing email campaign data', async () => {
      const campaignId = 'campaign-1';
      const campaignName = 'Test Campaign';

      const mockMarketingReport = {
        metrics: { conversions: 20, roi: 150 },
        recommendations: ['Optimize targeting']
      };

      mockMarketingClient.generateCampaignReport.mockResolvedValue(mockMarketingReport);

      const result = await orchestrator.generateComprehensiveCampaignReport(
        campaignId,
        campaignName
      );

      expect(mockMailjetClient.getEmailCampaignReport).not.toHaveBeenCalled();
      expect(result.emailPerformance).toBeUndefined();
      expect(result.marketingMetrics).toEqual(mockMarketingReport.metrics);
    });

    it('should handle service failures gracefully', async () => {
      const campaignId = 'campaign-1';
      const campaignName = 'Test Campaign';
      const mailjetCampaignId = 'email-campaign-1';

      mockMailjetClient.getEmailCampaignReport.mockRejectedValue(new Error('Email report error'));
      mockMarketingClient.generateCampaignReport.mockRejectedValue(new Error('Marketing report error'));

      const result = await orchestrator.generateComprehensiveCampaignReport(
        campaignId,
        campaignName,
        mailjetCampaignId
      );

      expect(result.summary).toContain('Test Campaign');
      expect(result.emailPerformance).toBeUndefined();
      expect(result.marketingMetrics).toBeUndefined();
      expect(result.recommendations).toEqual([]);
    });
  });

  describe('private helper methods', () => {
    it('should generate task email content correctly', async () => {
      const mockTask: Task = {
        id: 'task-1',
        title: 'Important Task',
        description: 'This is a test task',
        status: 'pending',
        priority: 'high',
        dueDate: new Date('2024-12-01'),
        estimatedHours: 8,
        assigneeEmail: 'assignee@example.com',
        campaignId: 'campaign-1',
        createdBy: 'creator@example.com',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockMailjetClient.sendTransactionalEmail.mockResolvedValue({
        messageId: 'msg-1',
        success: true
      });

      await orchestrator.assignTaskWithNotification(
        mockTask,
        'John Doe',
        'john@example.com'
      );

      expect(mockMailjetClient.sendTransactionalEmail).toHaveBeenCalledWith(
        'john@example.com',
        'New Task Assigned: Important Task',
        expect.stringContaining('Important Task'),
        expect.stringContaining('Important Task')
      );

      const htmlCall = mockMailjetClient.sendTransactionalEmail.mock.calls[0][2];
      const textCall = mockMailjetClient.sendTransactionalEmail.mock.calls[0][3];

      expect(htmlCall).toContain('<h3>Important Task</h3>');
      expect(htmlCall).toContain('This is a test task');
      expect(htmlCall).toContain('<strong>Priority:</strong> high');

      expect(textCall).toContain('Important Task');
      expect(textCall).toContain('This is a test task');
      expect(textCall).toContain('Priority: high');
    });
  });
});