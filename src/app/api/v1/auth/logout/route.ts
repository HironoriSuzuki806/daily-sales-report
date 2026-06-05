import { NextRequest, NextResponse } from 'next/server';

import { withErrorHandler } from '@/lib/api';
import { logout } from '@/services/auth.service';
import { clearSessionCookie } from '@/lib/session';

export const POST = withErrorHandler(async (request: NextRequest) => {
  // Blacklist the Bearer token (used by API clients).
  await logout(request);
  // Clear the HTTP-only session cookie (used by the Next.js app shell).
  await clearSessionCookie();
  return new NextResponse(null, { status: 204 });
});
