import { logger } from '../../utils/logger';
import { ListQualityAssessment } from '../agents/list-quality-agent';

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
    hardBounced?: number;
    softBounced?: number;
  };
  listQualityAssessment?: ListQualityAssessment;
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
   * Create about-to-send notification (15 minutes before)
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
                `*⏰ Launching in 15 minutes*`
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
      text: `Campaign launching in 15 minutes: ${data.campaignName} Round ${data.roundNumber}`,
      blocks
    };
  }

  /**
   * Create campaign launch notification (at launch time)
   */
  createLaunchNotification(data: CampaignNotificationData): any {
    const blocks = [
      {
        type: 'divider'
      },
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚀 CAMPAIGN LAUNCHING NOW'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${data.campaignName} - Round ${data.roundNumber}*\n\n` +
                `${this.STATUS_INDICATORS.active} *Campaign is now launching to ${data.targetCount.toLocaleString()} recipients*`
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Segment:* ${data.userRange}`
          },
          {
            type: 'mrkdwn',
            text: `*Launch Time:* ${data.executionTime} UTC`
          },
          {
            type: 'mrkdwn',
            text: `*Status:* ${this.STATUS_INDICATORS.active} IN PROGRESS`
          },
          {
            type: 'mrkdwn',
            text: `*Next Update:* 15 minutes`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Campaign Details:*'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${this.STATUS_INDICATORS.active} MailJet queue processing\n` +
                `${this.STATUS_INDICATORS.active} Real-time delivery tracking active\n` +
                `${this.STATUS_INDICATORS.active} Monitoring for bounces and deliverability\n` +
                `${this.STATUS_INDICATORS.active} Initial statistics available in 15 minutes`
        }
      },
      {
        type: 'divider'
      }
    ];

    return {
      text: `🚀 Campaign launching now: ${data.campaignName} Round ${data.roundNumber}`,
      blocks
    };
  }

  /**
   * Create post-launch notification with live MailJet data (15 min after launch)
   */
  createPostLaunchNotification(data: CampaignNotificationData): any {
    const progress = data.currentProgress!;
    const progressPercentage = Math.round((progress.sent / progress.total) * 100);
    const acceptanceRate = progress.accepted > 0 ? Math.round((progress.accepted / progress.sent) * 100) : 0;
    const bounceRate = progress.bounced > 0 ? Math.round((progress.bounced / progress.sent) * 100) : 0;
    const hardBounceRate = (progress.hardBounced && progress.sent > 0) ?
      ((progress.hardBounced / progress.sent) * 100).toFixed(2) : '0.00';

    const blocks: any[] = [
      {
        type: 'divider'
      },
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📊 POST-LAUNCH REPORT (15 MIN)'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${data.campaignName} - Round ${data.roundNumber}*\n\n` +
                `${this.STATUS_INDICATORS.active} *Campaign distribution in progress*`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Distribution Progress:*'
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Sent:* ${progress.sent.toLocaleString()} / ${progress.total.toLocaleString()} (${progressPercentage}%)`
          },
          {
            type: 'mrkdwn',
            text: `*Time Elapsed:* ${progress.timeElapsed}`
          },
          {
            type: 'mrkdwn',
            text: `*Delivered:* ${progress.accepted.toLocaleString()} (${acceptanceRate}%)`
          },
          {
            type: 'mrkdwn',
            text: `*Est. Completion:* ${progress.estimatedCompletion}`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Deliverability Metrics:*'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${acceptanceRate >= 95 ? this.STATUS_INDICATORS.completed : acceptanceRate >= 90 ? this.STATUS_INDICATORS.warning : this.STATUS_INDICATORS.failed} *Delivery Rate:* ${acceptanceRate}%\n` +
                `${bounceRate <= 2 ? this.STATUS_INDICATORS.completed : bounceRate <= 5 ? this.STATUS_INDICATORS.warning : this.STATUS_INDICATORS.failed} *Total Bounces:* ${progress.bounced} (${bounceRate}%)\n` +
                `${parseFloat(hardBounceRate) <= 0.5 ? this.STATUS_INDICATORS.completed : parseFloat(hardBounceRate) <= 1 ? this.STATUS_INDICATORS.warning : this.STATUS_INDICATORS.failed} *Hard Bounces:* ${progress.hardBounced || 0} (${hardBounceRate}%)\n` +
                `${this.STATUS_INDICATORS.active} *Queue Status:* Processing remaining ${(progress.total - progress.sent).toLocaleString()} emails`
        }
      }
    ];

    // Add AI list quality assessment if available
    if (data.listQualityAssessment) {
      const assessment = data.listQualityAssessment;

      // Quality score indicator
      const qualityEmoji = assessment.overallQuality === 'excellent' ? '🟢' :
                          assessment.overallQuality === 'good' ? '🟢' :
                          assessment.overallQuality === 'fair' ? '🟡' : '🔴';

      const healthEmoji = assessment.listHealthStatus === 'healthy' ? '✅' :
                         assessment.listHealthStatus === 'warning' ? '⚠️' : '🚨';

      blocks.push({
        type: 'divider'
      });

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*🤖 AI List Quality Assessment*\n\n${healthEmoji} *Status:* ${assessment.listHealthStatus.toUpperCase()} | ${qualityEmoji} *Quality:* ${assessment.overallQuality.toUpperCase()} (${assessment.qualityScore}/100)`
        }
      });

      // Executive summary
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Executive Summary:*\n${assessment.executiveSummary}`
        }
      });

      // Comparison with previous round (if available)
      if (data.roundNumber > 1 && assessment.comparison.significance) {
        const trendEmoji = assessment.comparison.trend === 'improving' ? '📈' :
                          assessment.comparison.trend === 'declining' ? '📉' : '➡️';

        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${trendEmoji} Round Comparison:*\n` +
                  `• Bounce Rate: ${assessment.comparison.bounceRateChange > 0 ? '+' : ''}${assessment.comparison.bounceRateChange}%\n` +
                  `• Delivery Rate: ${assessment.comparison.deliveryRateChange > 0 ? '+' : ''}${assessment.comparison.deliveryRateChange}%\n` +
                  `• Trend: ${assessment.comparison.trend.toUpperCase()}\n\n` +
                  `${assessment.comparison.significance}`
          }
        });
      }

      // Top insights (max 3)
      if (assessment.insights && assessment.insights.length > 0) {
        const topInsights = assessment.insights
          .sort((a, b) => {
            const impactScore = { high: 3, medium: 2, low: 1 };
            return impactScore[b.impact] - impactScore[a.impact];
          })
          .slice(0, 3);

        const insightsText = topInsights.map(insight => {
          const icon = insight.type === 'positive' ? '✅' :
                      insight.type === 'warning' ? '⚠️' : '🚨';
          return `${icon} *${insight.metric}:* ${insight.observation}`;
        }).join('\n');

        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Key Insights:*\n${insightsText}`
          }
        });
      }

      // Recommendations (max 3)
      if (assessment.recommendations && assessment.recommendations.length > 0) {
        const topRecs = assessment.recommendations.slice(0, 3);
        const recsText = topRecs.map((rec, idx) => `${idx + 1}. ${rec}`).join('\n');

        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Recommendations:*\n${recsText}`
          }
        });
      }

      // Predictions
      if (assessment.predictions) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Predictions:*\n` +
                  `• Next Round: ${assessment.predictions.nextRoundExpectations}\n` +
                  `• List Cleaning Needed: ${assessment.predictions.listCleaningNeeded ? '⚠️ YES' : '✅ NO'}\n` +
                  `• Est. Healthy Contacts: ${assessment.predictions.estimatedHealthyContacts.toLocaleString()}`
          }
        });
      }
    }

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Next Update:* Full completion report when all emails delivered'
      }
    });

    blocks.push({
      type: 'divider'
    });

    return {
      text: `Post-launch report: ${data.campaignName} Round ${data.roundNumber} - ${progress.sent}/${progress.total} sent (${progressPercentage}%)`,
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
   * Create AI-enhanced completion notification with analytics
   * This method will be used when AI agents are available
   */
  createAIEnhancedCompletionNotification(
    campaignName: string,
    roundNumber: number,
    formattedReport: any // FormattedCampaignReport from ReportFormattingAgent
  ): any {
    return {
      text: formattedReport.summary,
      blocks: formattedReport.blocks
    };
  }

  /**
   * Create completion notification (legacy - basic stats only)
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