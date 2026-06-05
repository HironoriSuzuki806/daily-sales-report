import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { ApiError } from './handler';
import { HttpStatus } from './http-status';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: 'SALES' | 'MANAGER' | 'ADMIN';
  departmentId: number;
}

// JWT 検証は認証基盤実装（Issue #5 相当）で置き換える。
// 現時点ではリクエストからトークンを取り出すインターフェースのみ定義する。
export function extractBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  return authorization.slice(7);
}

export async function extractBearerTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  // Cookie キー名は認証実装時に確定する
  return cookieStore.get('access_token')?.value ?? null;
}

/**
 * 現在の認証ユーザーを返す。
 * 認証実装が完了するまではスタブとして null を返す。
 * Route Handler では `null` の場合に 401 を返すこと。
 */
export async function getCurrentUser(_request: NextRequest): Promise<AuthUser | null> {
  // TODO: JWT 検証・DB 照合を実装する（Issue #5）
  return null;
}

/**
 * 認証済みユーザーを返す。未認証の場合は 401 をスローする。
 * Route Handler では getCurrentUser の代わりにこちらを使うことで認証チェック漏れを防ぐ。
 */
export async function requireAuth(request: NextRequest): Promise<AuthUser> {
  const user = await getCurrentUser(request);
  if (!user) throw new ApiError(HttpStatus.UNAUTHORIZED, '認証が必要です');
  return user;
}
