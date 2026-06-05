import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { ApiError } from './handler';
import { HttpStatus } from './http-status';
import { AuthError, extractBearerToken as extractBearer, verifyRequestToken } from '@/lib/auth';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: 'SALES' | 'MANAGER' | 'ADMIN';
  departmentId: number;
}

export function extractBearerToken(request: NextRequest): string | null {
  return extractBearer(request.headers.get('Authorization'));
}

export async function extractBearerTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('access_token')?.value ?? null;
}

export async function getCurrentUser(request: NextRequest): Promise<AuthUser | null> {
  try {
    const payload = await verifyRequestToken(request);
    return {
      id: Number(payload.sub),
      name: payload.name,
      email: payload.email,
      role: payload.role as AuthUser['role'],
      departmentId: Number(payload.departmentId),
    };
  } catch {
    return null;
  }
}

export async function requireAuth(request: NextRequest): Promise<AuthUser> {
  try {
    const payload = await verifyRequestToken(request);
    return {
      id: Number(payload.sub),
      name: payload.name,
      email: payload.email,
      role: payload.role as AuthUser['role'],
      departmentId: Number(payload.departmentId),
    };
  } catch (err) {
    if (err instanceof AuthError) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, err.message);
    }
    throw new ApiError(HttpStatus.UNAUTHORIZED, '認証が必要です');
  }
}
