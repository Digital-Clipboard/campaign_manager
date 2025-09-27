import { logger } from '../../utils/logger';

export interface CampaignNotificationData {
  campaignName: string;
  roundNumber: number;
  targetCount: number;
  userRange: string;
  executionTime: string;
  previousRoundStats?: {
    sent: number;
    deliveryRate: number;
    openRate: number;
    clickRate: number;
  };
  currentProgress?: {
    sent: number;
    total: number;
    timeElapsed: string;
    estimatedCompletion: string;
    accepted: number;
    bounced: number;
  };
  finalStats?: {
    totalSent: number;
    delivered: number;
    deliveryRate: number;
    bounced: number;
    bounceRate: number;
    duration: string;
  };
}

export class CampaignSlackNotifications {
  private readonly STATUS_INDICATORS = {
    pending: '○',
    inProgress: '◐',
    active: '●',
    completed: '✓',
    failed: '✗',
    warning: '⚠'
  };

  /**
   * Create pre-notification message (day before)
   */
  createPreNotification(data: CampaignNotificationData): any {
    const blocks = [
      {
        type: 'divider'
      },
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'CAMPAIGN NOTIFICATION'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${data.campaignName} - Round ${data.roundNumber}*`
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*STATUS:* Scheduled`
          },
          {
            type: 'mrkdwn',
            text: `*TARGET:* ${data.targetCount.toLocaleString()} recipients`
          },
          {
            type: 'mrkdwn',
            text: `*SEGMENT:* ${data.userRange}`
          },
          {
            type: 'mrkdwn',
            text: `*EXECUTION:* Tomorrow at ${data.executionTime}`
          }
        ]
      }
    ];

    // Add previous round performance if available
    if (data.previousRoundStats) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Previous Round Performance:*'
        }
      });
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${this.STATUS_INDICATORS.completed} Round ${data.roundNumber - 1}: Completed (${data.previousRoundStats.sent.toLocaleString()} sent)\n` +
                `${this.STATUS_INDICATORS.completed} Delivery Rate: ${data.previousRoundStats.deliveryRate}%\n` +
                `${this.STATUS_INDICATORS.completed} Open Rate: ${data.previousRoundStats.openRate}%\n` +
                `${this.STATUS_INDICATORS.completed} Click Rate: ${data.previousRoundStats.clickRate}%`
        }
      });
    }

    // Add pre-flight checklist
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Pre-flight Checklist:*'
      }
    });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${this.STATUS_INDICATORS.pending} Email template verified\n` +
              `${this.STATUS_INDICATORS.pending} Recipient list validated\n` +
              `${this.STATUS_INDICATORS.pending} MailJet API connected\n` +
              `${this.STATUS_INDICATORS.pending} Monitoring dashboard ready`
      }
    });
    blocks.push({
      type: 'divider'
    });

    return {
      text: `Campaign scheduled: ${data.campaignName} Round ${data.roundNumber} - Tomorrow at ${data.executionTime}`,
      blocks
    };
  }

  /**
   * Create preparation notification (morning of)
   */
  createPreparationNotification(data: CampaignNotificationData): any {
    const blocks = [
      {
        type: 'divider'
      },
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'CAMPAIGN PREPARATION'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${data.campaignName} - Round ${data.roundNumber}*\n` +
                `*T-3 Hours until execution*`
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*STATUS:* Systems Ready`
          },
          {
            type: 'mrkdwn',
            text: `*LAUNCH TIME:* ${data.executionTime}`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*System Checks:*'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${this.STATUS_INDICATORS.completed} MailJet API: Connected\n` +
                `${this.STATUS_INDICATORS.completed} Email Template: Loaded\n` +
                `${this.STATUS_INDICATORS.completed} Recipient List: ${data.targetCount.toLocaleString()} contacts ready\n` +
                `${this.STATUS_INDICATORS.completed} Rate Limiting: Configured\n` +
                `${this.STATUS_INDICATORS.completed} Error Handling: Active`
        }
      },
      {
        type: 'divider'
      }
    ];

    return {
      text: `Campaign preparation complete: ${data.campaignName} Round ${data.roundNumber} - Launching at ${data.executionTime}`,
      blocks
    };
  }

  /**
   * Create about-to-send notification (5 minutes before)
   */
  createAboutToSendNotification(data: CampaignNotificationData): any {
    const blocks = [
      {
        type: 'divider'
      },
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${this.STATUS_INDICATORS.warning} LAUNCH IMMINENT`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${data.campaignName} - Round ${data.roundNumber}*\n` +
                `*Launching in 5 minutes*`
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Recipients:* ${data.targetCount.toLocaleString()}`
          },
          {
            type: 'mrkdwn',
            text: `*Segment:* ${data.userRange}`
          },
          {
            type: 'mrkdwn',
            text: `*Launch Time:* ${data.executionTime}`
          },
          {
            type: 'mrkdwn',
            text: `*Status:* ${this.STATUS_INDICATORS.active} Armed`
          }
        ]
      },
      {
        type: 'divider'
      }
    ];

    return {
      text: `Campaign launching in 5 minutes: ${data.campaignName} Round ${data.roundNumber}`,
      blocks
    };
  }

  /**
   * Create execution/progress notification
   */
  createExecutionNotification(data: CampaignNotificationData): any {
    const progress = data.currentProgress!;
    const progressPercentage = Math.round((progress.sent / progress.total) * 100);
    const progressBar = this.createProgressBar(progressPercentage);

    const blocks = [
      {
        type: 'divider'
      },
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'CAMPAIGN EXECUTION IN PROGRESS'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${data.campaignName} - Round ${data.roundNumber}*\n\n` +
                `${this.STATUS_INDICATORS.active} *SENDING...*`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Progress:* ${progressBar} ${progressPercentage}%\n` +
                `*Sent:* ${progress.sent.toLocaleString()} / ${progress.total.toLocaleString()}\n` +
                `*Time Elapsed:* ${progress.timeElapsed}\n` +
                `*Est. Completion:* ${progress.estimatedCompletion}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Real-time Metrics:*'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${this.STATUS_INDICATORS.completed} Accepted: ${progress.accepted.toLocaleString()}\n` +
                `${this.STATUS_INDICATORS.failed} Bounced: ${progress.bounced}\n` +
                `${this.STATUS_INDICATORS.active} Queue Status: Active`
        }
      },
      {
        type: 'divider'
      }
    ];

    return {
      text: `Campaign in progress: ${data.campaignName} Round ${data.roundNumber} - ${progressPercentage}% complete`,
      blocks
    };
  }

  /**
   * Create completion notification
   */
  createCompletionNotification(data: CampaignNotificationData): any {
    const stats = data.finalStats!;
    const nextRound = data.roundNumber + 1;

    const blocks = [
      {
        type: 'divider'
      },
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'CAMPAIGN COMPLETED'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${data.campaignName} - Round ${data.roundNumber}*\n\n` +
                `${this.STATUS_INDICATORS.completed} *SUCCESS*`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Final Statistics:*'
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Total Sent:* ${stats.totalSent.toLocaleString()}`
          },
          {
            type: 'mrkdwn',
            text: `*Delivered:* ${stats.delivered.toLocaleString()} (${stats.deliveryRate}%)`
          },
          {
            type: 'mrkdwn',
            text: `*Bounced:* ${stats.bounced} (${stats.bounceRate}%)`
          },
          {
            type: 'mrkdwn',
            text: `*Duration:* ${stats.duration}`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Next Actions:*'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${this.STATUS_INDICATORS.pending} Round ${nextRound} scheduled: Thursday 10:00 AM\n` +
                `${this.STATUS_INDICATORS.pending} Recipients: Users 2,001+\n` +
                `${this.STATUS_INDICATORS.pending} Monitor opens/clicks at dashboard`
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Full Report'
            },
            url: `${process.env.DASHBOARD_URL || 'https://campaign-manager.herokuapp.com'}/campaigns/${data.campaignName}/round/${data.roundNumber}`
          }
        ]
      },
      {
        type: 'divider'
      }
    ];

    return {
      text: `Campaign completed: ${data.campaignName} Round ${data.roundNumber} - ${stats.totalSent.toLocaleString()} emails sent`,
      blocks
    };
  }

  /**
   * Create a visual progress bar using Unicode blocks
   */
  private createProgressBar(percentage: number): string {
    const totalBlocks = 10;
    const filledBlocks = Math.round((percentage / 100) * totalBlocks);
    const emptyBlocks = totalBlocks - filledBlocks;

    const filled = '█'.repeat(filledBlocks);
    const empty = '░'.repeat(emptyBlocks);

    return filled + empty;
  }

  /**
   * Create error/failure notification
   */
  createErrorNotification(campaignName: string, roundNumber: number, error: string): any {
    const blocks = [
      {
        type: 'divider'
      },
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${this.STATUS_INDICATORS.failed} CAMPAIGN ERROR`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${campaignName} - Round ${roundNumber}*\n\n` +
                `${this.STATUS_INDICATORS.failed} *FAILED*`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Error:* ${error}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${this.STATUS_INDICATORS.warning} *Immediate action required*\n` +
                'Please check the campaign dashboard and logs for details.'
        }
      },
      {
        type: 'divider'
      }
    ];

    return {
      text: `Campaign error: ${campaignName} Round ${roundNumber} - ${error}`,
      blocks
    };
  }

  /**
   * Create weekly summary notification
   */
  createWeeklySummaryNotification(data: {
    weekNumber: number;
    dateRange: string;
    campaigns: Array<{
      day: string;
      activities: Array<{
        time: string;
        name: string;
        type: 'launch' | 'milestone' | 'review' | 'preparation';
        details: string;
        recipientCount?: number;
        status: string;
      }>;
    }>;
    metrics: {
      totalCampaigns: number;
      totalRecipients: number;
      keyLaunches: number;
      reviewMeetings: number;
    };
    lastWeekPerformance?: {
      emailsSent: number;
      avgOpenRate: number;
      avgClickRate: number;
      bestPerformer: string;
      bestPerformerRate: number;
    };
    milestones: Array<{
      status: 'completed' | 'pending';
      description: string;
    }>;
    dashboardUrl: string;
  }): any {
    const blocks = [
      {
        type: 'divider'
      },
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'WEEKLY CAMPAIGN SCHEDULE'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Week ${data.weekNumber} • ${data.dateRange}*`
        }
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*WEEK AT A GLANCE*'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `• Campaigns: ${data.metrics.totalCampaigns} active\n` +
                `• Total Recipients: ${data.metrics.totalRecipients.toLocaleString()}\n` +
                `• Key Launches: ${data.metrics.keyLaunches}\n` +
                `• Review Meetings: ${data.metrics.reviewMeetings}`
        }
      }
    ];

    // Add daily campaign activities
    data.campaigns.forEach(dayData => {
      if (dayData.activities.length > 0) {
        blocks.push({
          type: 'divider'
        });
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${dayData.day.toUpperCase()}*`
          }
        });

        const activityText = dayData.activities.map(activity => {
          const statusIcon = this.STATUS_INDICATORS[activity.status] || this.STATUS_INDICATORS.pending;
          let activityLine = `${statusIcon} ${activity.time} - ${activity.name}`;
          if (activity.recipientCount) {
            activityLine += `\n  Target: ${activity.recipientCount.toLocaleString()} users • ${activity.details}`;
          } else {
            activityLine += `\n  ${activity.details}`;
          }
          return activityLine;
        }).join('\n\n');

        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: activityText
          }
        });
      }
    });

    // Add key milestones
    if (data.milestones.length > 0) {
      blocks.push({
        type: 'divider'
      });
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*KEY MILESTONES THIS WEEK*'
        }
      });

      const milestoneText = data.milestones.map(milestone => {
        const icon = milestone.status === 'completed' ?
          this.STATUS_INDICATORS.completed :
          this.STATUS_INDICATORS.pending;
        return `${icon} ${milestone.description}`;
      }).join('\n');

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: milestoneText
        }
      });
    }

    // Add last week's performance if available
    if (data.lastWeekPerformance) {
      blocks.push({
        type: 'divider'
      });
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*PERFORMANCE TRACKING*\nLast Week\'s Results:'
        }
      });
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `• Emails Sent: ${data.lastWeekPerformance.emailsSent.toLocaleString()}\n` +
                `• Avg Open Rate: ${data.lastWeekPerformance.avgOpenRate}%\n` +
                `• Avg Click Rate: ${data.lastWeekPerformance.avgClickRate}%\n` +
                `• Best Performer: ${data.lastWeekPerformance.bestPerformer} (${data.lastWeekPerformance.bestPerformerRate}% open)`
        }
      });
    }

    // Add dashboard link
    blocks.push({
      type: 'divider'
    });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*View Full Schedule Dashboard*'
      },
      accessory: {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'Open Dashboard'
        },
        url: data.dashboardUrl,
        action_id: 'view_dashboard'
      }
    });
    blocks.push({
      type: 'divider'
    });

    return {
      text: `Weekly Campaign Schedule - Week ${data.weekNumber}: ${data.metrics.totalCampaigns} campaigns scheduled`,
      blocks
    };
  }
}