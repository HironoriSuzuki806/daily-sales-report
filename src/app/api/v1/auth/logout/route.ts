import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { blacklistToken } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api';
import { logout } from '@/services/auth.service';
import { ACCESS_TOKEN_COOKIE, clearSessionCookie } from '@/lib/session';

export const POST = withErrorHandler(async (request: NextRequest) => {
  // Blacklist the Bearer token (used by API clients).
  await logout(request);
  // Also blacklist the Cookie token (used by the Next.js app shell via header.tsx).
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  if (cookieToken) {
    blacklistToken(cookieToken);
  }
  // Clear the HTTP-only session cookie (used by the Next.js app shell).
  await clearSessionCookie();
  return new NextResponse(null, { status: 204 });
});
