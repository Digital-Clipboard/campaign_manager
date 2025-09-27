import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const CAMPAIGN_MANAGER_URL = process.env.NEXT_PUBLIC_CAMPAIGN_MANAGER_URL || 'http://localhost:3007';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    // Verify token with Campaign Manager
    const response = await axios.post(`${CAMPAIGN_MANAGER_URL}/mcp`, {
      tool: 'verifyDashboardToken',
      params: { token }
    });

    if (response.data.success) {
      return NextResponse.json({ valid: true });
    } else {
      return NextResponse.json({ valid: false }, { status: 401 });
    }
  } catch (error) {
    console.error('Token verification error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}