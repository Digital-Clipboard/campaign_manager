# Heroku Scheduler Configuration

## Document Information
- Version: 1.0
- Date: 2025-09-27
- Status: Active
- Purpose: Document how to configure Heroku Scheduler for weekly campaign summaries

## Overview

The Campaign Manager uses Heroku Scheduler to automatically generate and post weekly campaign summaries to Slack every Monday at 0600 UTC. This document explains how to configure the scheduler.

## Prerequisites

1. **Heroku CLI installed**: Download from https://devcenter.heroku.com/articles/heroku-cli
2. **Heroku app deployed**: Campaign Manager must be deployed to Heroku
3. **Database configured**: PostgreSQL database with campaign schedule data
4. **Slack integration**: Slack Manager MCP connection established

## Configuration Steps

### Step 1: Add Heroku Scheduler Add-on

```bash
# Login to Heroku
heroku login

# Add scheduler to your app
heroku addons:create scheduler:standard -a your-campaign-manager-app

# Or if using free tier
heroku addons:create scheduler:free -a your-campaign-manager-app
```

### Step 2: Create Weekly Summary Script

Create a file `scripts/weekly-summary.js` in your Campaign Manager project:

```javascript
// scripts/weekly-summary.js
const axios = require('axios');
const { format, startOfWeek, endOfWeek, getISOWeek } = require('date-fns');

async function generateWeeklySummary() {
  const now = new Date();
  const weekNumber = getISOWeek(now);
  const year = now.getFullYear();

  try {
    // Get week's schedule from Campaign Manager
    const scheduleResponse = await axios.post(`${process.env.CAMPAIGN_MANAGER_URL}/mcp`, {
      tool: 'getWeekSchedule',
      params: { weekNumber, year }
    });

    if (!scheduleResponse.data.success) {
      throw new Error('Failed to get week schedule');
    }

    const schedule = scheduleResponse.data.schedule;

    // Get last week's performance metrics from Mailjet
    const lastWeek = weekNumber - 1;
    const metricsResponse = await axios.post(`${process.env.MAILJET_MCP_URL}/mailjet/analytics/weekly`, {
      weekNumber: lastWeek,
      year
    });

    // Format the weekly summary data
    const summaryData = {
      weekNumber,
      dateRange: `${format(startOfWeek(now), 'MMM dd')} - ${format(endOfWeek(now), 'MMM dd, yyyy')}`,
      campaigns: formatCampaignActivities(schedule),
      metrics: calculateWeekMetrics(schedule),
      lastWeekPerformance: metricsResponse.data.metrics,
      milestones: extractMilestones(schedule),
      dashboardUrl: `${process.env.DASHBOARD_URL}/schedule/week/${weekNumber}`
    };

    // Send to Slack via Campaign Manager
    const slackResponse = await axios.post(`${process.env.CAMPAIGN_MANAGER_URL}/mcp`, {
      tool: 'sendSlackNotification',
      params: {
        type: 'weeklySummary',
        data: summaryData,
        channel: '#traction'
      }
    });

    console.log(`Weekly summary posted successfully for Week ${weekNumber}`);
    process.exit(0);

  } catch (error) {
    console.error('Failed to generate weekly summary:', error.message);

    // Send error notification to Slack
    try {
      await axios.post(`${process.env.CAMPAIGN_MANAGER_URL}/mcp`, {
        tool: 'sendSlackNotification',
        params: {
          type: 'error',
          campaignName: 'Weekly Summary',
          roundNumber: weekNumber,
          error: error.message
        }
      });
    } catch (notifyError) {
      console.error('Failed to send error notification:', notifyError.message);
    }

    process.exit(1);
  }
}

function formatCampaignActivities(schedule) {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  return days.map(day => ({
    day,
    activities: (schedule[day] || []).map(activity => ({
      time: activity.time,
      name: activity.name,
      type: activity.activityType,
      details: activity.details || `Segment: ${activity.segment}`,
      recipientCount: activity.recipientCount,
      status: activity.status
    }))
  }));
}

function calculateWeekMetrics(schedule) {
  let totalCampaigns = 0;
  let totalRecipients = 0;
  let keyLaunches = 0;
  let reviewMeetings = 0;

  Object.values(schedule).forEach(dayActivities => {
    dayActivities.forEach(activity => {
      totalCampaigns++;
      if (activity.recipientCount) {
        totalRecipients += activity.recipientCount;
      }
      if (activity.activityType === 'launch') {
        keyLaunches++;
      }
      if (activity.activityType === 'review') {
        reviewMeetings++;
      }
    });
  });

  return {
    totalCampaigns,
    totalRecipients,
    keyLaunches,
    reviewMeetings
  };
}

function extractMilestones(schedule) {
  const milestones = [];

  Object.values(schedule).forEach(dayActivities => {
    dayActivities.forEach(activity => {
      if (activity.activityType === 'milestone') {
        milestones.push({
          status: activity.status === 'completed' ? 'completed' : 'pending',
          description: activity.name
        });
      }
    });
  });

  return milestones;
}

// Run the summary generation
generateWeeklySummary();
```

### Step 3: Configure Heroku Scheduler

1. **Open Heroku Scheduler Dashboard**:
```bash
heroku addons:open scheduler -a your-campaign-manager-app
```

2. **Add New Job**:
   - Click "Add Job" or "Create Job"
   - Enter command: `node scripts/weekly-summary.js`
   - Select frequency: **Weekly**
   - Select time: **Monday at 06:00 UTC**
   - Save the job

### Step 4: Set Environment Variables

Ensure these environment variables are set in Heroku:

```bash
# Set required environment variables
heroku config:set CAMPAIGN_MANAGER_URL=https://your-campaign-manager.herokuapp.com -a your-campaign-manager-app
heroku config:set MAILJET_MCP_URL=https://mailjet-agent-prod.herokuapp.com -a your-campaign-manager-app
heroku config:set DASHBOARD_URL=https://campaign-dashboard.vercel.app -a your-campaign-manager-app
heroku config:set SLACK_BOT_TOKEN=xoxb-your-slack-token -a your-campaign-manager-app
heroku config:set DATABASE_URL=postgres://your-database-url -a your-campaign-manager-app
```

### Step 5: Test the Scheduler

You can manually test the weekly summary generation:

```bash
# Test locally
node scripts/weekly-summary.js

# Test on Heroku
heroku run node scripts/weekly-summary.js -a your-campaign-manager-app
```

## Alternative: Using Node-Cron (Built-in Scheduling)

If you prefer not to use Heroku Scheduler, you can use node-cron within the application:

```javascript
// src/services/scheduler/weekly-summary.scheduler.ts
import * as cron from 'node-cron';
import { generateWeeklySummary } from '../summary/weekly-summary.service';

export function initializeWeeklySummaryScheduler() {
  // Schedule for every Monday at 06:00 UTC
  cron.schedule('0 6 * * 1', async () => {
    console.log('Starting weekly summary generation...');
    try {
      await generateWeeklySummary();
      console.log('Weekly summary generated successfully');
    } catch (error) {
      console.error('Failed to generate weekly summary:', error);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  console.log('Weekly summary scheduler initialized');
}

// Add to your main server file
// src/index.ts
import { initializeWeeklySummaryScheduler } from './services/scheduler/weekly-summary.scheduler';

// Initialize scheduler on server start
initializeWeeklySummaryScheduler();
```

## Monitoring and Troubleshooting

### View Scheduler Logs

```bash
# View recent logs
heroku logs --tail -a your-campaign-manager-app

# View scheduler-specific logs
heroku logs --source scheduler -a your-campaign-manager-app
```

### Common Issues

1. **Job Not Running**:
   - Verify scheduler add-on is active: `heroku addons -a your-campaign-manager-app`
   - Check job configuration in scheduler dashboard
   - Verify time zone settings (Heroku uses UTC)

2. **Authentication Failures**:
   - Verify SLACK_BOT_TOKEN is set correctly
   - Check DATABASE_URL connection string
   - Ensure MCP endpoints are accessible

3. **No Data in Summary**:
   - Check if campaign schedules exist for current week
   - Verify database connection
   - Test `getWeekSchedule` MCP tool directly

### Manual Trigger via API

You can also trigger the weekly summary manually via API:

```bash
curl -X POST https://your-campaign-manager.herokuapp.com/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "generateWeeklySummary",
    "params": {
      "weekNumber": 42,
      "year": 2025
    }
  }'
```

## Backup and Recovery

### Missed Schedule Recovery

If the scheduler fails to run, you can manually generate summaries for past weeks:

```javascript
// scripts/recover-summary.js
const weekNumber = process.argv[2];
const year = process.argv[3];

if (!weekNumber || !year) {
  console.error('Usage: node scripts/recover-summary.js <weekNumber> <year>');
  process.exit(1);
}

// Generate summary for specific week
generateWeeklySummary(parseInt(weekNumber), parseInt(year));
```

Run recovery:
```bash
heroku run node scripts/recover-summary.js 41 2025 -a your-campaign-manager-app
```

## Security Considerations

1. **Token Security**:
   - Store all tokens as environment variables
   - Rotate tokens periodically
   - Use Heroku's config vars for sensitive data

2. **Access Control**:
   - Scheduler runs with app-level permissions
   - Ensure MCP endpoints validate requests
   - Dashboard requires authentication tokens

3. **Rate Limiting**:
   - Implement rate limiting on MCP endpoints
   - Respect Slack API rate limits
   - Add retry logic with exponential backoff

## Maintenance

### Weekly Checklist

- [ ] Verify scheduler ran successfully (check Slack #traction)
- [ ] Review any error notifications
- [ ] Check dashboard accessibility
- [ ] Monitor database performance

### Monthly Tasks

- [ ] Review scheduler logs for patterns
- [ ] Optimize summary generation performance
- [ ] Update summary format based on feedback
- [ ] Rotate access tokens if needed