// Define the WeeklySummaryData interface locally to match server-minimal.ts
export interface WeeklySummaryData {
  weekNumber: number;
  dateRange: string;
  campaigns: Array<{
    day: string;
    activities: Array<{
      name: string;
      time: string;
      status: string;
      type?: string;
      details?: string;
      recipientCount?: number;
    }>;
  }>;
  metrics?: {
    totalActivities: number;
    totalRecipients: number;
    emailCampaigns: number;
    productLaunches: number;
    webinars: number;
    reviewMeetings: number;
  };
  milestones?: Array<{
    status: 'pending' | 'completed';
    description: string;
  }>;
  dashboardUrl: string;
}

/**
 * Format weekly traction summary as plain text with markdown
 * Following the successful pattern from Stripe Health Monitor
 */
export function formatWeeklySummaryText(
  weekSummaryData: WeeklySummaryData,
  weekNumber: number,
  year: number,
  activitiesCount: number,
  aiEnhancement?: {
    weekSummary?: string;
    keyInsights?: string[];
    businessImpact?: string;
    recommendedActions?: string[];
  }
): string {
  const lines: string[] = [];

  // Header with enhanced formatting (like Stripe Health Monitor)
  lines.push('*🔹 WEEKLY TRACTION SUMMARY*');
  lines.push('─────────────────────────');
  lines.push(`*Week ${weekNumber}, ${year}* | ${weekSummaryData.dateRange}`);
  lines.push('');
  lines.push('');

  // Key metrics section
  lines.push('*📊 Key Metrics*');
  lines.push('```');

  // Calculate metrics
  const totalRecipients = weekSummaryData.campaigns.reduce((sum, day) =>
    sum + day.activities.reduce((daySum, activity) =>
      daySum + (activity.recipientCount || 0), 0
    ), 0
  );

  const productLaunches = weekSummaryData.campaigns.reduce((sum, day) =>
    sum + day.activities.filter(a =>
      a.type?.toLowerCase().includes('launch') ||
      a.type?.toLowerCase().includes('release')
    ).length, 0
  );

  // Format metrics with proper alignment
  lines.push(`Total Activities:     ${activitiesCount.toString().padStart(6)}`);
  lines.push(`Total Recipients:     ${totalRecipients.toLocaleString().padStart(6)}`);
  lines.push(`Product Launches:     ${productLaunches.toString().padStart(6)}`);
  lines.push(`Key Milestones:       ${weekSummaryData.milestones?.length || 0}`.padEnd(27));
  lines.push('```');
  lines.push('');

  // AI-enhanced summary if available
  if (aiEnhancement?.weekSummary) {
    lines.push('*📈 Weekly Overview*');
    lines.push('```');
    lines.push(aiEnhancement.weekSummary);
    lines.push('```');
    lines.push('');
  }

  // Schedule section
  if (weekSummaryData.campaigns.length > 0) {
    lines.push('*📅 This Week\'s Activities*');
    lines.push('```');

    weekSummaryData.campaigns.forEach(day => {
      if (day.activities.length > 0) {
        lines.push(`${day.day}:`);
        day.activities.forEach(activity => {
          const statusIcon = activity.status === 'completed' ? '✓' :
                           activity.status === 'in_progress' ? '◐' :
                           activity.status === 'pending' ? '○' : '●';
          lines.push(`  ${statusIcon} ${activity.time} - ${activity.name}`);
          if (activity.details) {
            lines.push(`      ${activity.details}`);
          }
          if (activity.recipientCount && activity.recipientCount > 0) {
            lines.push(`      Target: ${activity.recipientCount.toLocaleString()} recipients`);
          }
        });
        lines.push('');
      }
    });

    lines.push('```');
    lines.push('');
  }

  // Key insights
  if (aiEnhancement?.keyInsights && aiEnhancement.keyInsights.length > 0) {
    lines.push('*💡 Key Insights*');
    lines.push('```');
    aiEnhancement.keyInsights.forEach(insight => {
      lines.push(`• ${insight}`);
    });
    lines.push('```');
    lines.push('');
  }

  // Recommended actions
  if (aiEnhancement?.recommendedActions && aiEnhancement.recommendedActions.length > 0) {
    lines.push('*🎯 Recommended Actions*');
    lines.push('```');
    aiEnhancement.recommendedActions.forEach(action => {
      lines.push(`• ${action}`);
    });
    lines.push('```');
    lines.push('');
  }

  // Footer with dashboard link
  lines.push('─────────────────────────');
  lines.push(`_Generated ${new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short'
  })}_`);
  lines.push('');
  lines.push(`*Dashboard:* <${weekSummaryData.dashboardUrl}|View Full Dashboard>`);

  return lines.join('\n');
}