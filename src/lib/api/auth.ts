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
    departmentId: deptId !== null && Number.isFinite(deptId) ? deptId : null,
  };
}

/**
 * Extracts the JWT from the Authorization Bearer header (preferred, for API clients)
 * or falls back to the session cookie (for same-origin browser requests).
 */
function resolveToken(request: NextRequest): string | null {
  return (
    extractBearer(request.headers.get('Authorization')) ??
    request.cookies.get(ACCESS_TOKEN_COOKIE)?.value ??
    null
  );
}

export async function getCurrentUser(request: NextRequest): Promise<AuthUser | null> {
  const fromHeaders = userFromProxyHeaders(request);
  if (fromHeaders) return fromHeaders;

  const token = resolveToken(request);
  if (!token || isTokenBlacklisted(token)) return null;

  try {
    const payload = await verifyToken(token);
    return {
      id: Number(payload.sub),
      name: payload.name,
      email: payload.email,
      role: payload.role as AuthUser['role'],
      departmentId: payload.departmentId ? Number(payload.departmentId) : null,
    };
  } catch {
    return null;
  }
}

export async function requireAuth(request: NextRequest): Promise<AuthUser> {
  const fromHeaders = userFromProxyHeaders(request);
  if (fromHeaders) return fromHeaders;

  const token = resolveToken(request);
  if (!token) {
    throw new ApiError(HttpStatus.UNAUTHORIZED, '認証が必要です');
  }

  if (isTokenBlacklisted(token)) {
    throw new ApiError(HttpStatus.UNAUTHORIZED, 'トークンは無効化されています');
  }

  try {
    const payload = await verifyToken(token);
    return {
      id: Number(payload.sub),
      name: payload.name,
      email: payload.email,
      role: payload.role as AuthUser['role'],
      departmentId: payload.departmentId ? Number(payload.departmentId) : null,
    };
  } catch (err) {
    if (err instanceof AuthError) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, err.message);
    }
    throw new ApiError(HttpStatus.UNAUTHORIZED, '認証が必要です');
  }
}
