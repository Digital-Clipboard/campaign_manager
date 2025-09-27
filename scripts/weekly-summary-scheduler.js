#!/usr/bin/env node

/**
 * Weekly Summary Scheduler for Heroku
 * Calls the generateWeeklySummary MCP tool to send weekly summaries to Slack
 * Designed to run via Heroku Scheduler every Monday at 06:00 UTC
 */

const axios = require('axios');

// Get current week and year dynamically
function getCurrentWeekInfo() {
  const now = new Date();

  // Get ISO week number
  const start = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now - start) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + start.getDay() + 1) / 7);

  return {
    weekNumber,
    year: now.getFullYear()
  };
}

async function generateWeeklySummary() {
  const { weekNumber, year } = getCurrentWeekInfo();

  console.log(`🗓️  Generating weekly summary for Week ${weekNumber}, ${year}`);

  try {
    const response = await axios.post(`http://localhost:${process.env.PORT || 3000}/mcp`, {
      tool: 'generateWeeklySummary',
      params: {
        weekNumber,
        year
      }
    }, {
      timeout: 30000, // 30 second timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.data.success) {
      console.log('✅ Weekly summary generated and sent to Slack successfully');
      console.log(`📊 Activities found: ${response.data.activitiesCount}`);
      console.log(`🔗 Dashboard: ${response.data.weekSummaryData?.dashboardUrl || 'N/A'}`);

      // Exit with success
      process.exit(0);
    } else {
      console.error('❌ Failed to generate weekly summary:', response.data.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error calling weekly summary service:', error.message);

    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }

    process.exit(1);
  }
}

// Main execution
if (require.main === module) {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

  console.log('🚀 Weekly Summary Scheduler starting...');
  console.log(`⏰ Timestamp: ${now.toISOString()}`);
  console.log(`📅 Day of week: ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

  // Only run on Mondays (day 1)
  if (dayOfWeek !== 1) {
    console.log('⏭️  Not Monday - skipping weekly summary generation');
    console.log('✅ Scheduler executed successfully (no action needed)');
    process.exit(0);
  }

  console.log('📅 It\'s Monday! Generating weekly summary...');
  generateWeeklySummary().catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { generateWeeklySummary, getCurrentWeekInfo };