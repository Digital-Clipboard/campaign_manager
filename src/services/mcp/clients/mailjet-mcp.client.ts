import axios, { AxiosInstance } from 'axios';
import jwt from 'jsonwebtoken';
import { logger } from '../../../utils/logger';
import { CacheService } from '../../cache/cache.service';

export interface MailjetCampaignStats {
  campaignId: string;
  subject: string;
  status: 'draft' | 'sent' | 'archived';
  sentAt?: Date;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  spam: number;
  unsubscribed: number;
  openRate: number;
  clickRate: number;
}

export interface MailjetTemplate {
  id: string;
  name: string;
  category?: string;
  variables: string[];
  lastUsed?: Date;
  performanceScore?: number;
}

export interface MailjetEmailBatch {
  campaignName: string;
  templateId: string;
  recipients: Array<{
    email: string;
    name: string;
    variables: Record<string, any>;
  }>;
  testMode?: boolean;
  scheduledAt?: Date;
}

/**
 * MailjetMCPClient - Client for Mailjet MCP Server integration
 */
export class MailjetMCPClient {
  private client: AxiosInstance;
  private mcpUrl: string;
  private mcpToken: string;
  private agentId: string;

  constructor(private cache: CacheService) {
    this.mcpUrl = process.env.MAILJET_MCP_URL || 'https://mailjet-agent-prod-d874b6b38888.herokuapp.com';
    this.mcpToken = process.env.MAILJET_MCP_TOKEN || '99720c1062c70118002ebc0cb32359c31739dafe7b3b9fda0f8e6fe856d40ea6';
    this.agentId = process.env.MAILJET_AGENT_ID || 'campaign-manager-client';

    this.client = axios.create({
      baseURL: this.mcpUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add request interceptor for authentication
    this.client.interceptors.request.use((config) => {
      config.headers.Authorization = `Bearer ${this.generateToken()}`;
      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error('Mailjet MCP request failed', {
          error: error.message,
          url: error.config?.url,
          status: error.response?.status
        });
        throw error;
      }
    );
  }

  /**
   * Generate JWT token for MCP authentication
   */
  private generateToken(): string {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

    const payload = {
      agentId: this.agentId,
      permissions: [
        'statistics:read',
        'campaigns:read',
        'campaigns:write',
        'templates:read',
        'templates:write',
        'contacts:read',
        'analytics:read',
        'send:write'
      ],
      expiresAt: expiresAt.toISOString()
    };

    return jwt.sign(payload, this.mcpToken);
  }

  /**
   * Get campaign statistics from Mailjet
   */
  async getCampaignStatistics(mailjetCampaignId: string): Promise<MailjetCampaignStats> {
    try {
      // Check cache first
      const cacheKey = `mailjet:stats:${mailjetCampaignId}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Fetch from Mailjet MCP
      const response = await this.client.post('/mailjet/campaigns/statistics', {
        campaignId: mailjetCampaignId
      });

      const stats: MailjetCampaignStats = {
        campaignId: response.data.data.id,
        subject: response.data.data.subject,
        status: response.data.data.status,
        sentAt: response.data.data.sentAt ? new Date(response.data.data.sentAt) : undefined,
        sent: response.data.data.statistics?.sent || 0,
        delivered: response.data.data.statistics?.delivered || 0,
        opened: response.data.data.statistics?.opened || 0,
        clicked: response.data.data.statistics?.clicked || 0,
        bounced: response.data.data.statistics?.bounced || 0,
        spam: response.data.data.statistics?.spam || 0,
        unsubscribed: response.data.data.statistics?.unsubscribed || 0,
        openRate: response.data.data.statistics?.openRate || 0,
        clickRate: response.data.data.statistics?.clickRate || 0
      };

      // Cache the result
      await this.cache.set(cacheKey, JSON.stringify(stats), 300); // 5 minutes

      return stats;

    } catch (error) {
      logger.error('Failed to get campaign statistics', {
        error: (error as Error).message,
        mailjetCampaignId
      });
      throw error;
    }
  }

  /**
   * Send campaign emails through Mailjet
   */
  async sendCampaignEmails(batch: MailjetEmailBatch): Promise<{ campaignId: string; messageIds: string[] }> {
    try {
      logger.info('Sending campaign emails through Mailjet', {
        campaignName: batch.campaignName,
        recipientCount: batch.recipients.length
      });

      // Prepare messages for Mailjet
      const messages = batch.recipients.map(recipient => ({
        From: {
          Email: process.env.MAILJET_FROM_EMAIL || 'noreply@campaign-manager.com',
          Name: process.env.MAILJET_FROM_NAME || 'Campaign Manager'
        },
        To: [{
          Email: recipient.email,
          Name: recipient.name
        }],
        TemplateID: parseInt(batch.templateId),
        TemplateLanguage: true,
        Variables: recipient.variables,
        CustomCampaign: batch.campaignName,
        DeduplicateCampaign: true,
        EventPayload: batch.testMode ? 'test' : 'production'
      }));

      // Send in batches of 50 (Mailjet limit)
      const batchSize = 50;
      const messageIds: string[] = [];
      let campaignId = '';

      for (let i = 0; i < messages.length; i += batchSize) {
        const messageBatch = messages.slice(i, i + batchSize);

        const response = await this.client.post('/mailjet/send_bulk', {
          messages: messageBatch,
          sandboxMode: batch.testMode || false,
          ...(batch.scheduledAt && { scheduledAt: batch.scheduledAt.toISOString() })
        });

        if (response.data.success) {
          messageIds.push(...(response.data.data.messageIds || []));
          campaignId = campaignId || response.data.data.campaignId;
        }
      }

      logger.info('Campaign emails sent successfully', {
        campaignId,
        messageCount: messageIds.length
      });

      return { campaignId, messageIds };

    } catch (error) {
      logger.error('Failed to send campaign emails', {
        error: (error as Error).message,
        campaignName: batch.campaignName
      });
      throw error;
    }
  }

  /**
   * List email templates
   */
  async listTemplates(category?: string): Promise<MailjetTemplate[]> {
    try {
      // Check cache
      const cacheKey = `mailjet:templates:${category || 'all'}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Fetch from Mailjet MCP
      const response = await this.client.post('/mailjet/templates/list', {
        limit: 100,
        ...(category && { category })
      });

      const templates: MailjetTemplate[] = response.data.data.templates.map((t: any) => ({
        id: t.id,
        name: t.name,
        category: t.category,
        variables: t.variables || [],
        lastUsed: t.lastUsed ? new Date(t.lastUsed) : undefined
      }));

      // Cache for 1 hour
      await this.cache.set(cacheKey, JSON.stringify(templates), 3600);

      return templates;

    } catch (error) {
      logger.error('Failed to list templates', {
        error: (error as Error).message,
        category
      });
      throw error;
    }
  }

  /**
   * Get template details
   */
  async getTemplate(templateId: string): Promise<MailjetTemplate> {
    try {
      // Check cache
      const cacheKey = `mailjet:template:${templateId}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Fetch from Mailjet MCP
      const response = await this.client.post('/mailjet/templates/get', {
        templateId
      });

      const template: MailjetTemplate = {
        id: response.data.data.id,
        name: response.data.data.name,
        category: response.data.data.category,
        variables: response.data.data.variables || [],
        lastUsed: response.data.data.lastUsed ? new Date(response.data.data.lastUsed) : undefined,
        performanceScore: response.data.data.performanceScore
      };

      // Cache for 1 hour
      await this.cache.set(cacheKey, JSON.stringify(template), 3600);

      return template;

    } catch (error) {
      logger.error('Failed to get template', {
        error: (error as Error).message,
        templateId
      });
      throw error;
    }
  }

  /**
   * Search campaigns by subject
   */
  async findCampaignBySubject(subject: string): Promise<MailjetCampaignStats | null> {
    try {
      const response = await this.client.post('/mailjet/campaigns/find_by_subject', {
        subjectSearch: subject
      });

      if (!response.data.success) {
        return null;
      }

      const campaign = response.data.data;

      return {
        campaignId: campaign.id,
        subject: campaign.subject,
        status: campaign.status,
        sentAt: campaign.sentAt ? new Date(campaign.sentAt) : undefined,
        sent: campaign.statistics?.sent || 0,
        delivered: campaign.statistics?.delivered || 0,
        opened: campaign.statistics?.opened || 0,
        clicked: campaign.statistics?.clicked || 0,
        bounced: campaign.statistics?.bounced || 0,
        spam: campaign.statistics?.spam || 0,
        unsubscribed: campaign.statistics?.unsubscribed || 0,
        openRate: campaign.statistics?.openRate || 0,
        clickRate: campaign.statistics?.clickRate || 0
      };

    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      logger.error('Failed to find campaign by subject', {
        error: (error as Error).message,
        subject
      });
      throw error;
    }
  }

  /**
   * Create email template
   */
  async createTemplate(template: {
    name: string;
    subject: string;
    htmlContent: string;
    textContent?: string;
    category?: string;
  }): Promise<{ id: string; name: string }> {
    try {
      const response = await this.client.post('/mailjet/templates/create', template);

      if (!response.data.success) {
        throw new Error('Failed to create template');
      }

      return {
        id: response.data.data.id,
        name: response.data.data.name
      };

    } catch (error) {
      logger.error('Failed to create template', {
        error: (error as Error).message,
        templateName: template.name
      });
      throw error;
    }
  }

  /**
   * Send test email
   */
  async sendTestEmail(data: {
    to: string;
    templateId: string;
    variables: Record<string, any>;
  }): Promise<boolean> {
    try {
      const response = await this.client.post('/mailjet/send', {
        to: data.to,
        templateId: data.templateId,
        variables: data.variables,
        sandboxMode: true
      });

      return response.data.success;

    } catch (error) {
      logger.error('Failed to send test email', {
        error: (error as Error).message,
        to: data.to
      });
      return false;
    }
  }
}