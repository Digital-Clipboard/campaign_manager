import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const CAMPAIGN_MANAGER_URL = process.env.NEXT_PUBLIC_CAMPAIGN_MANAGER_URL || 'http://localhost:3007';

export async function verifyToken(token: string): Promise<boolean> {
  try {
    // Verify token with Campaign Manager
    const response = await axios.post(`${CAMPAIGN_MANAGER_URL}/mcp`, {
      tool: 'verifyDashboardToken',
      params: { token }
    });

    return response.data.success === true;
  } catch (error) {
    console.error('Token verification failed:', error);
    return false;
  }
}

export async function requireAuth(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ||
                request.cookies.get('dashboard_token')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const isValid = await verifyToken(token);

  if (!isValid) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Set cookie if token was in URL
  if (request.nextUrl.searchParams.get('token')) {
    const response = NextResponse.next();
    response.cookies.set('dashboard_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });
    return response;
  }

  return NextResponse.next();
}