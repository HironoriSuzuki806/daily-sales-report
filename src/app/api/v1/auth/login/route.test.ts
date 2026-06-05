// @vitest-environment node
import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { POST } from './route';

vi.mock('@/services/auth.service', () => ({
  login: vi.fn(),
}));

import { login } from '@/services/auth.service';
const mockLogin = login as ReturnType<typeof vi.fn>;

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/v1/auth/login', () => {
  beforeEach(() => vi.clearAllMocks());

  it('200: 正しい資格情報でトークンを返す', async () => {
    const loginResult = {
      accessToken: 'jwt-token',
      tokenType: 'Bearer' as const,
      expiresIn: 3600,
      user: { id: 12, name: '山田太郎', role: 'SALES' },
    };
    mockLogin.mockResolvedValue(loginResult);

    const res = await POST(makeRequest({ email: 'yamada@example.com', password: 'password' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.accessToken).toBe('jwt-token');
    expect(body.user.id).toBe(12);
  });

  it('400: メールアドレス未入力は Zod エラー', async () => {
    const res = await POST(makeRequest({ email: '', password: 'password' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.fieldErrors).toBeDefined();
    expect(body.fieldErrors.some((e: { field: string }) => e.field === 'email')).toBe(true);
  });

  it('400: メールアドレス形式不正は Zod エラー', async () => {
    const res = await POST(makeRequest({ email: 'not-an-email', password: 'password' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.fieldErrors.some((e: { field: string }) => e.field === 'email')).toBe(true);
  });

  it('400: パスワード未入力は Zod エラー', async () => {
    const res = await POST(makeRequest({ email: 'yamada@example.com', password: '' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.fieldErrors.some((e: { field: string }) => e.field === 'password')).toBe(true);
  });

  it('400: リクエストボディなしは Zod エラー', async () => {
    const res = await POST(makeRequest({}));

    expect(res.status).toBe(400);
  });

  it('401: 認証失敗時は 401 を返す', async () => {
    const { AuthError } = await import('@/lib/auth');
    mockLogin.mockRejectedValue(new AuthError('メールアドレスまたはパスワードが正しくありません'));

    const res = await POST(makeRequest({ email: 'yamada@example.com', password: 'wrong' }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.message).toBe('メールアドレスまたはパスワードが正しくありません');
  });

  it('500: 予期しないエラーは 500 を返す', async () => {
    mockLogin.mockRejectedValue(new Error('DB connection failed'));

    const res = await POST(makeRequest({ email: 'yamada@example.com', password: 'password' }));

    expect(res.status).toBe(500);
  });
});
