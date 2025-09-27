import { logger } from '@/utils/logger';
import axios from 'axios';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
  }>;
}

/**
 * EmailService - Handles email sending via Mailjet
 */
export class EmailService {
  private apiKey: string;
  private apiSecret: string;
  private fromEmail: string;
  private fromName: string;
  private baseUrl = 'https://api.mailjet.com/v3.1';

  constructor() {
    this.apiKey = process.env.MAILJET_API_KEY || '';
    this.apiSecret = process.env.MAILJET_API_SECRET || '';
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@campaign-manager.com';
    this.fromName = process.env.EMAIL_FROM_NAME || 'Campaign Manager';
  }

  /**
   * Send email via Mailjet
   */
  async sendEmail(message: EmailMessage): Promise<boolean> {
    try {
      if (!this.apiKey || !this.apiSecret) {
        logger.warn('Mailjet credentials not configured, skipping email send');
        return false;
      }

      const payload = {
        Messages: [{
          From: {
            Email: message.from || this.fromEmail,
            Name: this.fromName
          },
          To: [{
            Email: message.to,
            Name: message.to.split('@')[0]
          }],
          Subject: message.subject,
          TextPart: message.text || this.stripHtml(message.html),
          HTMLPart: message.html,
          CustomID: `campaign-manager-${Date.now()}`,
          ...(message.replyTo && { ReplyTo: { Email: message.replyTo } }),
          ...(message.cc && { Cc: message.cc.map(email => ({ Email: email })) }),
          ...(message.bcc && { Bcc: message.bcc.map(email => ({ Email: email })) }),
          ...(message.attachments && {
            Attachments: message.attachments.map(att => ({
              ContentType: att.contentType,
              Filename: att.filename,
              Base64Content: att.content
            }))
          })
        }]
      };

      const response = await axios.post(`${this.baseUrl}/send`, payload, {
        auth: {
          username: this.apiKey,
          password: this.apiSecret
        },
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data.Messages[0].Status === 'success') {
        logger.info('Email sent successfully', {
          to: message.to,
          subject: message.subject,
          messageId: response.data.Messages[0].MessageID
        });
        return true;
      }

      logger.error('Email send failed', {
        to: message.to,
        subject: message.subject,
        error: response.data.Messages[0].Errors
      });
      return false;

    } catch (error) {
      logger.error('Failed to send email', {
        error: (error as Error).message,
        to: message.to,
        subject: message.subject
      });
      return false;
    }
  }

  /**
   * Send bulk emails
   */
  async sendBulkEmails(messages: EmailMessage[]): Promise<number> {
    let successCount = 0;

    // Process in batches of 50 (Mailjet limit)
    const batchSize = 50;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(msg => this.sendEmail(msg))
      );
      successCount += results.filter(r => r).length;
    }

    return successCount;
  }

  /**
   * Generate email from template
   */
  generateEmailFromTemplate(
    templateName: string,
    variables: Record<string, any>
  ): string {
    const templates: Record<string, string> = {
      'approval-request': `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Approval Required</h2>
          <p>Hi {{approverName}},</p>
          <p>Your approval is required for the campaign <strong>{{campaignName}}</strong>.</p>
          <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <p><strong>Stage:</strong> {{stage}}</p>
            <p><strong>Priority:</strong> {{urgency}}</p>
            <p><strong>Deadline:</strong> {{deadline}}</p>
          </div>
          <p>Please review and provide your decision:</p>
          <a href="{{approvalUrl}}" style="display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">Review Approval</a>
        </div>
      `,
      'approval-reminder': `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Approval Reminder</h2>
          <p>Hi {{approverName}},</p>
          <p>This is a reminder that your approval is still pending for:</p>
          <p><strong>{{campaignName}}</strong> - {{stage}} stage</p>
          <p style="color: #dc3545;">Deadline: {{deadline}}</p>
          <a href="{{approvalUrl}}" style="display: inline-block; padding: 10px 20px; background: #dc3545; color: white; text-decoration: none; border-radius: 5px;">Review Now</a>
        </div>
      `,
      'approval-escalated': `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc3545;">⚠️ Escalated Approval</h2>
          <p>Hi {{approverName}},</p>
          <p>An approval request has been <strong>ESCALATED</strong> due to being overdue:</p>
          <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <p><strong>Campaign:</strong> {{campaignName}}</p>
            <p><strong>Stage:</strong> {{stage}}</p>
            <p><strong>Original Deadline:</strong> {{deadline}}</p>
            <p><strong>Days Overdue:</strong> {{daysOverdue}}</p>
          </div>
          <p>Immediate action is required.</p>
          <a href="{{approvalUrl}}" style="display: inline-block; padding: 10px 20px; background: #dc3545; color: white; text-decoration: none; border-radius: 5px;">Review Immediately</a>
        </div>
      `,
      'task-assigned': `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>New Task Assigned</h2>
          <p>Hi {{assigneeName}},</p>
          <p>You have been assigned a new task:</p>
          <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <p><strong>Task:</strong> {{taskTitle}}</p>
            <p><strong>Campaign:</strong> {{campaignName}}</p>
            <p><strong>Due Date:</strong> {{dueDate}}</p>
            <p><strong>Priority:</strong> {{priority}}</p>
          </div>
          <p>{{description}}</p>
          <a href="{{taskUrl}}" style="display: inline-block; padding: 10px 20px; background: #28a745; color: white; text-decoration: none; border-radius: 5px;">View Task</a>
        </div>
      `,
      'campaign-status-change': `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Campaign Status Update</h2>
          <p>Hi {{recipientName}},</p>
          <p>The campaign <strong>{{campaignName}}</strong> status has changed:</p>
          <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <p><strong>Previous Status:</strong> {{oldStatus}}</p>
            <p><strong>New Status:</strong> {{newStatus}}</p>
            <p><strong>Changed By:</strong> {{changedBy}}</p>
            <p><strong>Time:</strong> {{changedAt}}</p>
          </div>
          {{#if notes}}
          <p><strong>Notes:</strong> {{notes}}</p>
          {{/if}}
          <a href="{{campaignUrl}}" style="display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">View Campaign</a>
        </div>
      `
    };

    let html = templates[templateName] || templates['approval-request'];

    // Replace variables
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, String(value));
    });

    // Handle conditional blocks
    html = html.replace(/{{#if (\w+)}}([\s\S]*?){{\/if}}/g, (match, varName, content) => {
      return variables[varName] ? content : '';
    });

    return html;
  }

  /**
   * Strip HTML tags from string
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
  }

  /**
   * Validate email address
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}