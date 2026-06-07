import { NextRequest } from 'next/server';
import { ApiError } from './handler';
import { HttpStatus } from './http-status';
import { AuthError, extractBearerToken as extractBearer, verifyRequestToken } from '@/lib/auth';

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

function userFromProxyHeaders(request: NextRequest): AuthUser | null {
  const id = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role');
  if (!id || !role) return null;
  return {
    id: Number(id),
    name: decodeURIComponent(request.headers.get('x-user-name') ?? ''),
    email: request.headers.get('x-user-email') ?? '',
    role: role as AuthUser['role'],
    departmentId: request.headers.get('x-user-department-id')
      ? Number(request.headers.get('x-user-department-id'))
      : null,
  };
}

export async function getCurrentUser(request: NextRequest): Promise<AuthUser | null> {
  const fromHeaders = userFromProxyHeaders(request);
  if (fromHeaders) return fromHeaders;

  try {
    const payload = await verifyRequestToken(request);
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

  try {
    const payload = await verifyRequestToken(request);
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
