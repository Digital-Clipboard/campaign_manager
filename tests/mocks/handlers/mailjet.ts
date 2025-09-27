import { http, HttpResponse } from 'msw';

export const mailjetHandlers = [
  // Mailjet validate campaign
  http.post('http://mailjet-agent:3004/mcp/tools/mj_validate_campaign', () => {
    return HttpResponse.json({
      success: true,
      validation: {
        html_valid: true,
        links_valid: true,
        images_optimized: true,
        deliverability_score: 85
      }
    });
  }),

  // Mailjet check deliverability
  http.post('http://mailjet-agent:3004/mcp/tools/mj_check_deliverability', () => {
    return HttpResponse.json({
      success: true,
      deliverability: {
        score: 88,
        issues: [],
        recommendations: ['Consider A/B testing subject lines']
      }
    });
  }),

  // Mailjet schedule send
  http.post('http://mailjet-agent:3004/mcp/tools/mj_schedule_send', () => {
    return HttpResponse.json({
      success: true,
      message_id: 'MJ_MSG_123456',
      scheduled_for: new Date(Date.now() + 3600000).toISOString()
    });
  }),

  // Upload campaign HTML
  http.post('http://mailjet-agent:3004/mcp/tools/mailjet_upload_campaign_html', () => {
    return HttpResponse.json({
      success: true,
      template_id: 'TEMPLATE_123',
      version: 1
    });
  }),
];