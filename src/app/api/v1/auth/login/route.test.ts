// @vitest-environment node
import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { POST } from './route';

vi.mock('@/services/auth.service', () => ({
  login: vi.fn(),
}));

// `setSessionCookie` calls `next/headers` cookies(), which is unavailable
// outside a real Next.js request context. Mock the entire session module.
vi.mock('@/lib/session', () => ({
  setSessionCookie: vi.fn().mockResolvedValue(undefined),
  clearSessionCookie: vi.fn().mockResolvedValue(undefined),
  getSessionUser: vi.fn().mockResolvedValue(null),
}));

import { login } from '@/services/auth.service';
import { setSessionCookie } from '@/lib/session';
const mockLogin = login as ReturnType<typeof vi.fn>;
const mockSetSessionCookie = setSessionCookie as ReturnType<typeof vi.fn>;

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/v1/auth/login', () => {
  beforeEach(() => vi.clearAllMocks());

  it('TC-AUTH-001: 正しい資格情報でログイン → 200 + トークン取得', async () => {
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
    // Cookie にトークンが正しくセットされることを検証
    expect(mockSetSessionCookie).toHaveBeenCalledOnce();
    expect(mockSetSessionCookie).toHaveBeenCalledWith('jwt-token');
  });

  it('TC-AUTH-004: メールアドレス未入力 → 400', async () => {
    const res = await POST(makeRequest({ email: '', password: 'password' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.fieldErrors).toBeDefined();
    expect(body.fieldErrors.some((e: { field: string }) => e.field === 'email')).toBe(true);
  });

  it('TC-AUTH-004: メールアドレス形式不正 → 400', async () => {
    const res = await POST(makeRequest({ email: 'not-an-email', password: 'password' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.fieldErrors.some((e: { field: string }) => e.field === 'email')).toBe(true);
  });

  it('TC-AUTH-004: パスワード未入力 → 400', async () => {
    const res = await POST(makeRequest({ email: 'yamada@example.com', password: '' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.fieldErrors.some((e: { field: string }) => e.field === 'password')).toBe(true);
  });

  it('TC-AUTH-004: リクエストボディなし → 400', async () => {
    const res = await POST(makeRequest({}));

    expect(res.status).toBe(400);
  });

  it('TC-AUTH-002: パスワード誤り → 401', async () => {
    const { AuthError } = await import('@/lib/auth');
    mockLogin.mockRejectedValue(new AuthError('メールアドレスまたはパスワードが正しくありません'));

    const res = await POST(makeRequest({ email: 'yamada@example.com', password: 'wrong' }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.message).toBe('メールアドレスまたはパスワードが正しくありません');
  });

  it('TC-AUTH-003: 未登録メール → 401', async () => {
    const { AuthError } = await import('@/lib/auth');
    mockLogin.mockRejectedValue(new AuthError('メールアドレスまたはパスワードが正しくありません'));

    const res = await POST(
      makeRequest({ email: 'notregistered@example.com', password: 'password' })
    );
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
