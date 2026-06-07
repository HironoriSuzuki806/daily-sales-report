import { jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server';

import { isTokenBlacklisted } from '@/lib/auth';

const ACCESS_TOKEN_COOKIE = 'access_token';

type Role = 'SALES' | 'MANAGER' | 'ADMIN';

interface MiddlewareUser {
  sub: string;
  name: string;
  email: string;
  role: Role;
  departmentId?: string;
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return new TextEncoder().encode(secret);
}

function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return request.cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
}

function errorJson(status: 401 | 403, message: string, pathname: string): NextResponse {
  return NextResponse.json(
    {
      timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, ''),
      status,
      error: status === 401 ? 'Unauthorized' : 'Forbidden',
      message,
      path: pathname,
    },
    { status }
  );
}

/**
 * Returns true when the given role is allowed to access the route.
 *
 * Route requirements (from API spec §2.6):
 *   /api/v1/auth/*            — public (handled before this function)
 *   /api/v1/daily-reports/*   — SALES or MANAGER
 *   /api/v1/customers/*       — GET: any authenticated; POST/PUT/DELETE: ADMIN
 *   /api/v1/salespersons      — GET (list): any authenticated; all others: ADMIN
 *   /api/v1/salespersons/*    — ADMIN
 *   /api/v1/departments       — GET (list): any authenticated; all others: ADMIN
 *   /api/v1/departments/*     — ADMIN
 *   everything else           — any authenticated user
 */
function checkRbac(pathname: string, method: string, role: Role): boolean {
  if (pathname.startsWith('/api/v1/daily-reports')) {
    return role === 'SALES' || role === 'MANAGER';
  }

  if (pathname.startsWith('/api/v1/customers')) {
    return method === 'GET' || role === 'ADMIN';
  }

  if (pathname.startsWith('/api/v1/salespersons')) {
    if (method === 'GET' && pathname === '/api/v1/salespersons') return true;
    return role === 'ADMIN';
  }

  if (pathname.startsWith('/api/v1/departments')) {
    if (method === 'GET' && pathname === '/api/v1/departments') return true;
    return role === 'ADMIN';
  }

  return true;
}

const USER_HEADER_KEYS = [
  'x-user-id',
  'x-user-name',
  'x-user-email',
  'x-user-role',
  'x-user-department-id',
] as const;

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Auth endpoints are public — let them through without verification.
  if (pathname.startsWith('/api/v1/auth/')) {
    return NextResponse.next();
  }

  const token = extractToken(request);
  if (!token) {
    return errorJson(401, '認証が必要です', pathname);
  }

  if (isTokenBlacklisted(token)) {
    return errorJson(401, 'トークンは無効化されています', pathname);
  }

  let user: MiddlewareUser;
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (
      typeof payload.sub !== 'string' ||
      typeof payload['name'] !== 'string' ||
      typeof payload['email'] !== 'string' ||
      !['SALES', 'MANAGER', 'ADMIN'].includes(payload['role'] as string)
    ) {
      return errorJson(401, 'トークンが無効です', pathname);
    }
    user = {
      sub: payload.sub,
      name: payload['name'] as string,
      email: payload['email'] as string,
      role: payload['role'] as Role,
      departmentId:
        typeof payload['departmentId'] === 'string' ? payload['departmentId'] : undefined,
    };
  } catch {
    return errorJson(401, 'トークンが無効または期限切れです', pathname);
  }

  if (!checkRbac(pathname, request.method, user.role)) {
    return errorJson(403, 'この操作を行う権限がありません', pathname);
  }

  // Build forwarded headers:
  //   1. Strip any incoming x-user-* headers to prevent spoofing.
  //   2. Set verified user fields so route handlers can trust them.
  //   3. If the token arrived via cookie (no Authorization header), inject it as
  //      a Bearer token so existing verifyRequestToken / requireAuth calls work.
  const requestHeaders = new Headers(request.headers);
  for (const key of USER_HEADER_KEYS) {
    requestHeaders.delete(key);
  }
  requestHeaders.set('x-user-id', user.sub);
  requestHeaders.set('x-user-name', encodeURIComponent(user.name));
  requestHeaders.set('x-user-email', user.email);
  requestHeaders.set('x-user-role', user.role);
  if (user.departmentId) {
    requestHeaders.set('x-user-department-id', user.departmentId);
  }

  if (!request.headers.get('Authorization')?.startsWith('Bearer ')) {
    requestHeaders.set('Authorization', `Bearer ${token}`);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/api/v1/:path*'],
};
