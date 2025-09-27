import { http, HttpResponse } from 'msw';

export const marketingHandlers = [
  // Marketing Agent get campaign performance
  http.post('http://marketing-agent:3003/mcp/tools/ma_get_campaign_performance', () => {
    return HttpResponse.json({
      success: true,
      performance: {
        open_rate: 0.25,
        click_rate: 0.08,
        conversion_rate: 0.03,
        revenue_generated: 15000,
        roi: 3.2
      }
    });
  }),

  // Marketing Agent get audience insights
  http.post('http://marketing-agent:3003/mcp/tools/ma_get_audience_insights', () => {
    return HttpResponse.json({
      success: true,
      insights: {
        segments: [
          { name: 'Power Users', size: 1250, engagement: 0.45 },
          { name: 'New Subscribers', size: 3400, engagement: 0.28 }
        ],
        best_send_time: '2024-01-15T10:00:00Z',
        recommended_frequency: 'weekly'
      }
    });
  }),

  // Marketing Agent predict performance
  http.post('http://marketing-agent:3003/mcp/tools/ma_predict_performance', () => {
    return HttpResponse.json({
      success: true,
      prediction: {
        expected_open_rate: 0.27,
        expected_click_rate: 0.09,
        confidence: 0.85,
        factors: ['subject_line_sentiment', 'send_time', 'audience_segment']
      }
    });
  }),

  // Campaign launched notification
  http.post('http://marketing-agent:3003/mcp/tools/cm_campaign_launched', () => {
    return HttpResponse.json({
      success: true,
      handoff_id: 'HANDOFF_123456',
      status: 'received',
      estimated_processing_time: '2 hours'
    });
  }),
];