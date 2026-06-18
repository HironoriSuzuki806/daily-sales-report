import { NextRequest } from 'next/server';
import { ApiError } from './handler';
import { HttpStatus } from './http-status';
import {
  AuthError,
  extractBearerToken as extractBearer,
  isTokenBlacklisted,
  verifyToken,
} from '@/lib/auth';
import { ACCESS_TOKEN_COOKIE } from '@/lib/session';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: 'SALES' | 'MANAGER' | 'ADMIN';
  departmentId: number | null;
}

export function extractBearerToken(request: NextRequest): string | null {
  return extractBearer(request.headers.get('Authorization'));
}

const VALID_ROLES: AuthUser['role'][] = ['SALES', 'MANAGER', 'ADMIN'];

function userFromProxyHeaders(request: NextRequest): AuthUser | null {
  const id = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role');
  if (!id || !role) return null;

  const numId = Number(id);
  if (!Number.isFinite(numId)) return null;
  if (!VALID_ROLES.includes(role as AuthUser['role'])) return null;

  const deptIdStr = request.headers.get('x-user-department-id');
  const deptId = deptIdStr ? Number(deptIdStr) : null;

  return {
    id: numId,
    name: decodeURIComponent(request.headers.get('x-user-name') ?? ''),
    email: request.headers.get('x-user-email') ?? '',
    role: role as AuthUser['role'],
    // Proxy headers represent a pre-authenticated identity from a trusted internal
    // gateway. The blacklist is NOT checked — the gateway validates tokens itself.
    departmentId: deptId !== null && Number.isFinite(deptId) ? deptId : null,
  };
}

type TokenSource = { token: string; source: 'bearer' | 'cookie' };

/**
 * Extracts the JWT from the Authorization Bearer header (preferred, for API clients)
 * or falls back to the session cookie (for same-origin browser requests).
 */
function resolveToken(request: NextRequest): TokenSource | null {
  const bearer = extractBearer(request.headers.get('Authorization'));
  if (bearer) return { token: bearer, source: 'bearer' };
  const cookie = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (cookie) return { token: cookie, source: 'cookie' };
  return null;
}

/**
 * CSRF guard for cookie-authenticated requests.
 * When auth comes from the session cookie (not an explicit Bearer header), verify
 * the Origin header matches the Host to block cross-site requests from a compromised
 * subdomain. SameSite=Lax already blocks most CSRF, but this adds defence-in-depth.
 * Requests with no Origin header (server-to-server, same-origin GET) are allowed.
 */
function assertSameOriginForCookieAuth(request: NextRequest): void {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) return;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError(HttpStatus.FORBIDDEN, 'オリジンが不正です');
  }

  if (originHost !== host) {
    throw new ApiError(HttpStatus.FORBIDDEN, 'オリジンが不正です');
  }
}

async function buildAuthUser(token: string): Promise<AuthUser> {
  const payload = await verifyToken(token);
  return {
    id: Number(payload.sub),
    name: payload.name,
    email: payload.email,
    role: payload.role as AuthUser['role'],
    departmentId: payload.departmentId ? Number(payload.departmentId) : null,
  };
}

export async function getCurrentUser(request: NextRequest): Promise<AuthUser | null> {
  const fromHeaders = userFromProxyHeaders(request);
  if (fromHeaders) return fromHeaders;

  const resolved = resolveToken(request);
  if (!resolved || isTokenBlacklisted(resolved.token)) return null;

  try {
    return await buildAuthUser(resolved.token);
  } catch {
    return null;
  }
}

export async function requireAuth(request: NextRequest): Promise<AuthUser> {
  const fromHeaders = userFromProxyHeaders(request);
  if (fromHeaders) return fromHeaders;

  const resolved = resolveToken(request);
  if (!resolved) {
    throw new ApiError(HttpStatus.UNAUTHORIZED, '認証が必要です');
  }

  if (resolved.source === 'cookie') {
    assertSameOriginForCookieAuth(request);
  }

  if (isTokenBlacklisted(resolved.token)) {
    throw new ApiError(HttpStatus.UNAUTHORIZED, 'トークンは無効化されています');
  }

  try {
    return await buildAuthUser(resolved.token);
  } catch (err) {
    if (err instanceof AuthError) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, err.message);
    }
    throw new ApiError(HttpStatus.UNAUTHORIZED, '認証が必要です');
  }
}
