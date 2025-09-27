import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Skip auth for login page and API auth routes
  if (request.nextUrl.pathname === '/login' ||
      request.nextUrl.pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  // Check for dashboard token
  const token = request.cookies.get('dashboard_token');

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|api/auth).*)',
  ],
};