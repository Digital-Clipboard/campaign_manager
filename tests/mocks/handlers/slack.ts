import { http, HttpResponse } from 'msw';

export const slackHandlers = [
  // Slack post message
  http.post('http://slack-manager:3005/mcp/tools/slack_post_message', () => {
    return HttpResponse.json({
      success: true,
      message_id: 'MSG123456',
      timestamp: new Date().toISOString(),
      channel: 'C1234567890'
    });
  }),

  // Slack send DM
  http.post('http://slack-manager:3005/mcp/tools/slack_send_dm', () => {
    return HttpResponse.json({
      success: true,
      message_id: 'DM123456',
      timestamp: new Date().toISOString()
    });
  }),

  // Slack create thread
  http.post('http://slack-manager:3005/mcp/tools/slack_create_thread', () => {
    return HttpResponse.json({
      success: true,
      thread_ts: '1234567890.123456',
      message_id: 'THREAD123'
    });
  }),

  // Slack add reminder
  http.post('http://slack-manager:3005/mcp/tools/slack_add_reminder', () => {
    return HttpResponse.json({
      success: true,
      reminder_id: 'REMINDER123'
    });
  }),
];