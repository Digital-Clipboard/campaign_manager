import { BaseMCPClient } from './base-mcp-client';
import { logger } from '@/utils/logger';

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  variables?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailCampaign {
  id: string;
  name: string;
  templateId: string;
  contactListId: string;
  status: 'draft' | 'scheduled' | 'sent' | 'cancelled';
  scheduledFor?: Date;
  sentAt?: Date;
}

export interface CampaignDraft {
  id: bigint;
  campaignId?: bigint;
  subject: string;
  senderName: string;
  senderEmail: string;
  contactListId: bigint;
  status: 'draft' | 'programmed' | 'sent';
  createdAt: Date;
}

export interface EmailStatistics {
  campaignId: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  hardBounced: number;
  softBounced: number;
  spam: number;
  unsubscribed: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
}

export interface DetailedCampaignStatistics {
  campaignId: bigint;
  processed: number;
  delivered: number;
  bounced: number;
  hardBounces: number;
  softBounces: number;
  blocked: number;
  queued: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  complained: number;
  sendStartAt?: Date;
  sendEndAt?: Date;
}

export interface ContactList {
  id: string;
  name: string;
  contactCount: number;
  isActive: boolean;
}

export interface Contact {
  id: string;
  email: string;
  name?: string;
  properties?: Record<string, any>;
  subscribed: boolean;
}

export class MailjetAgentClient extends BaseMCPClient {
  constructor() {
    super({
      name: 'mailjet-agent',
      url: process.env.MAILJET_AGENT_URL || 'https://mailjet-agent-prod.herokuapp.com',
      apiKey: process.env.MAILJET_AGENT_API_KEY,
      timeout: 30000
    });
  }

  // Template Management
  async createEmailTemplate(
    name: string,
    subject: string,
    htmlContent: string,
    textContent?: string
  ): Promise<EmailTemplate> {
    return this.callTool<EmailTemplate>('create_email_template', {
      name,
      subject,
      html_content: htmlContent,
      text_content: textContent
    });
  }

  async updateEmailTemplate(
    templateId: string,
    updates: {
      name?: string;
      subject?: string;
      htmlContent?: string;
      textContent?: string;
    }
  ): Promise<EmailTemplate> {
    return this.callTool<EmailTemplate>('update_email_template', {
      template_id: templateId,
      ...updates
    });
  }

  async getEmailTemplate(templateId: string): Promise<EmailTemplate> {
    return this.callTool<EmailTemplate>('get_email_template', {
      template_id: templateId
    });
  }

  async listEmailTemplates(category?: string): Promise<EmailTemplate[]> {
    return this.callTool<EmailTemplate[]>('list_email_templates', { category }) || [];
  }

  async deleteEmailTemplate(templateId: string): Promise<boolean> {
    const result = await this.callTool<{ success: boolean }>('delete_email_template', {
      template_id: templateId
    });
    return result.success;
  }

  // Campaign Management
  async createEmailCampaign(
    name: string,
    templateId: string,
    contactListId: string,
    scheduledFor?: Date
  ): Promise<EmailCampaign> {
    return this.callTool<EmailCampaign>('create_email_campaign', {
      name,
      template_id: templateId,
      contact_list_id: contactListId,
      scheduled_for: scheduledFor?.toISOString()
    });
  }

  async sendEmailCampaign(campaignId: string): Promise<{
    success: boolean;
    sentCount: number;
    failedCount: number;
  }> {
    return this.callTool('send_email_campaign', {
      campaign_id: campaignId
    });
  }

  async scheduleEmailCampaign(
    campaignId: string,
    scheduledFor: Date
  ): Promise<EmailCampaign> {
    return this.callTool<EmailCampaign>('schedule_email_campaign', {
      campaign_id: campaignId,
      scheduled_for: scheduledFor.toISOString()
    });
  }

  async cancelEmailCampaign(campaignId: string): Promise<boolean> {
    const result = await this.callTool<{ success: boolean }>('cancel_email_campaign', {
      campaign_id: campaignId
    });
    return result.success;
  }

  async getEmailStatistics(campaignId: string): Promise<EmailStatistics> {
    return this.callTool<EmailStatistics>('get_email_statistics', {
      campaign_id: campaignId
    });
  }

  // Contact List Management
  async createContactList(name: string, contacts?: Contact[]): Promise<ContactList> {
    return this.callTool<ContactList>('create_contact_list', {
      name,
      contacts
    });
  }

  async addContactsToList(
    listId: string,
    contacts: Array<{ email: string; name?: string; properties?: Record<string, any> }>
  ): Promise<{
    added: number;
    failed: number;
    errors?: string[];
  }> {
    return this.callTool('add_contacts_to_list', {
      list_id: listId,
      contacts
    });
  }

  async removeContactsFromList(
    listId: string,
    emails: string[]
  ): Promise<{
    removed: number;
    failed: number;
  }> {
    return this.callTool('remove_contacts_from_list', {
      list_id: listId,
      emails
    });
  }

  async getContactList(listId: string): Promise<ContactList> {
    return this.callTool<ContactList>('get_contact_list', {
      list_id: listId
    });
  }

  async listContactLists(): Promise<ContactList[]> {
    return this.callTool<ContactList[]>('list_contact_lists') || [];
  }

  // Transactional Emails
  async sendTransactionalEmail(
    to: string | string[],
    subject: string,
    htmlContent: string,
    textContent?: string,
    variables?: Record<string, any>
  ): Promise<{
    messageId: string;
    success: boolean;
  }> {
    return this.callTool('send_transactional_email', {
      to: Array.isArray(to) ? to : [to],
      subject,
      html_content: htmlContent,
      text_content: textContent,
      variables
    });
  }

  async sendBulkEmails(
    messages: Array<{
      to: string;
      subject: string;
      htmlContent: string;
      textContent?: string;
      variables?: Record<string, any>;
    }>
  ): Promise<{
    sent: number;
    failed: number;
    messageIds: string[];
  }> {
    return this.callTool('send_bulk_emails', { messages });
  }

  // Analytics and Reporting
  async getBounceStatistics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalBounces: number;
    hardBounces: number;
    softBounces: number;
    bounceRate: number;
    bouncedEmails: string[];
  }> {
    return this.callTool('get_bounce_statistics', {
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString()
    });
  }

  async getEngagementMetrics(
    campaignId: string
  ): Promise<{
    engagementScore: number;
    mostClickedLinks: Array<{ url: string; clicks: number }>;
    deviceBreakdown: Record<string, number>;
    timeBreakdown: Record<string, number>;
  }> {
    return this.callTool('get_engagement_metrics', {
      campaign_id: campaignId
    });
  }

  // Helper Methods for Campaign Manager Integration

  async launchEmailCampaign(
    campaignName: string,
    subject: string,
    htmlContent: string,
    contactEmails: string[],
    scheduledFor?: Date
  ): Promise<{
    campaign: EmailCampaign;
    template: EmailTemplate;
    contactList: ContactList;
  }> {
    try {
      logger.info('Launching email campaign via Mailjet', { campaignName });

      // Create template
      const template = await this.createEmailTemplate(
        campaignName,
        subject,
        htmlContent
      );

      // Create contact list
      const contactList = await this.createContactList(
        `${campaignName} - Recipients`,
        contactEmails.map(email => ({ email, subscribed: true }))
      );

      // Create campaign
      const campaign = await this.createEmailCampaign(
        campaignName,
        template.id,
        contactList.id,
        scheduledFor
      );

      // Send immediately if not scheduled
      if (!scheduledFor) {
        await this.sendEmailCampaign(campaign.id);
      }

      return {
        campaign,
        template,
        contactList
      };

    } catch (error) {
      logger.error('Failed to launch email campaign', { campaignName, error });
      throw error;
    }
  }

  async getEmailCampaignReport(campaignId: string): Promise<{
    statistics: EmailStatistics;
    engagement: any;
    recommendations: string[];
  }> {
    try {
      const [statistics, engagement] = await Promise.all([
        this.getEmailStatistics(campaignId),
        this.getEngagementMetrics(campaignId)
      ]);

      const recommendations: string[] = [];

      // Generate recommendations based on statistics
      if (statistics.openRate < 20) {
        recommendations.push('Consider improving subject lines for better open rates');
      }

      if (statistics.clickRate < 2) {
        recommendations.push('Enhance call-to-action buttons and content relevance');
      }

      if (statistics.bounceRate > 5) {
        recommendations.push('Clean email list to reduce bounce rate');
      }

      if (statistics.unsubscribed > statistics.sent * 0.01) {
        recommendations.push('Review content strategy - high unsubscribe rate detected');
      }

      return {
        statistics,
        engagement,
        recommendations
      };

    } catch (error) {
      logger.error('Failed to get email campaign report', { campaignId, error });
      throw error;
    }
  }

  async validateEmailList(emails: string[]): Promise<{
    valid: string[];
    invalid: string[];
    risky: string[];
  }> {
    return this.callTool('validate_email_list', { emails });
  }

  async getEmailDeliverability(): Promise<{
    score: number;
    issues: string[];
    recommendations: string[];
  }> {
    return this.callTool('get_email_deliverability');
  }

  // ============================================
  // LIFECYCLE-SPECIFIC METHODS
  // ============================================

  /**
   * Get campaign draft by ID
   * Used in Pre-Flight verification stage
   */
  async getCampaignDraft(draftId: bigint): Promise<CampaignDraft> {
    return this.callTool<CampaignDraft>('get_campaign_draft', {
      draft_id: draftId.toString()
    });
  }

  /**
   * Get detailed campaign statistics for lifecycle metrics
   * Returns all metrics needed for AI analysis
   */
  async getDetailedCampaignStatistics(
    campaignId: bigint
  ): Promise<DetailedCampaignStatistics> {
    return this.callTool<DetailedCampaignStatistics>('get_detailed_campaign_statistics', {
      campaign_id: campaignId.toString()
    });
  }

  /**
   * Send a campaign immediately
   * Used in Launch Confirmation stage
   */
  async sendCampaignNow(campaignId: bigint): Promise<{
    success: boolean;
    messageId: string;
    queuedCount: number;
  }> {
    return this.callTool('send_campaign_now', {
      campaign_id: campaignId.toString()
    });
  }

  /**
   * Verify campaign is ready to send
   * Pre-flight checks before launch
   */
  async verifyCampaignReadiness(draftId: bigint): Promise<{
    isReady: boolean;
    issues: Array<{
      severity: 'error' | 'warning' | 'info';
      message: string;
      field?: string;
    }>;
    checks: {
      hasSubject: boolean;
      hasSender: boolean;
      hasContactList: boolean;
      hasContent: boolean;
      listNotEmpty: boolean;
      noBlockedContacts: boolean;
    };
  }> {
    return this.callTool('verify_campaign_readiness', {
      draft_id: draftId.toString()
    });
  }

  /**
   * Get list statistics for list quality analysis
   */
  async getListStatistics(listId: bigint): Promise<{
    listId: bigint;
    totalContacts: number;
    subscribedContacts: number;
    unsubscribedContacts: number;
    blockedContacts: number;
    recentBounces: number;
    listHealth: number; // 0-100 score
  }> {
    return this.callTool('get_list_statistics', {
      list_id: listId.toString()
    });
  }

  /**
   * Get sender reputation score
   */
  async getSenderReputation(senderEmail: string): Promise<{
    email: string;
    reputationScore: number; // 0-100
    totalSent: number;
    totalDelivered: number;
    totalBounced: number;
    totalComplaints: number;
    recentTrend: 'improving' | 'stable' | 'declining';
    recommendations: string[];
  }> {
    return this.callTool('get_sender_reputation', {
      sender_email: senderEmail
    });
  }
}