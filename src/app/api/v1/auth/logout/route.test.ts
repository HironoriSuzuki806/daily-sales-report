// @vitest-environment node
import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted ensures these are initialised before vi.mock factories run.
const { mockCookiesGet } = vi.hoisted(() => ({
  mockCookiesGet: vi.fn(),
}));

import { POST } from './route';

vi.mock('@/services/auth.service', () => ({
  logout: vi.fn(),
}));

// `clearSessionCookie` calls `next/headers` cookies(), which is unavailable
// outside a real Next.js request context. Mock the entire session module.
vi.mock('@/lib/session', () => ({
  ACCESS_TOKEN_COOKIE: 'access_token',
  clearSessionCookie: vi.fn().mockResolvedValue(undefined),
  setSessionCookie: vi.fn().mockResolvedValue(undefined),
  getSessionUser: vi.fn().mockResolvedValue(null),
}));

// Mock next/headers cookies() used in the route to read the Cookie token.
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: mockCookiesGet }),
}));

// Mock blacklistToken so we can assert it is called with the Cookie token.
vi.mock('@/lib/auth', () => ({
  blacklistToken: vi.fn(),
  isTokenBlacklisted: vi.fn().mockReturnValue(false),
}));

import { logout } from '@/services/auth.service';
import { clearSessionCookie } from '@/lib/session';
import { blacklistToken } from '@/lib/auth';
const mockLogout = logout as ReturnType<typeof vi.fn>;
const mockClearSessionCookie = clearSessionCookie as ReturnType<typeof vi.fn>;
const mockBlacklistToken = blacklistToken as ReturnType<typeof vi.fn>;

describe('POST /api/v1/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // デフォルト: Cookie にトークンなし
    mockCookiesGet.mockReturnValue(undefined);
  });

  it('204: 正常ログアウト（Bearer トークンあり）', async () => {
    mockLogout.mockResolvedValue(undefined);

    const req = new NextRequest('http://localhost/api/v1/auth/logout', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
    });
    const res = await POST(req);

    expect(res.status).toBe(204);
    expect(mockLogout).toHaveBeenCalledOnce();
    // clearSessionCookie が呼び出されることを検証
    expect(mockClearSessionCookie).toHaveBeenCalledOnce();
  });

  it('204: Cookie にトークンがある場合はブラックリスト登録される', async () => {
    mockLogout.mockResolvedValue(undefined);
    mockCookiesGet.mockReturnValue({ value: 'cookie-token' });

    const req = new NextRequest('http://localhost/api/v1/auth/logout', { method: 'POST' });
    const res = await POST(req);

    expect(res.status).toBe(204);
    // Cookie トークンがブラックリスト登録されることを検証
    expect(mockBlacklistToken).toHaveBeenCalledWith('cookie-token');
    expect(mockClearSessionCookie).toHaveBeenCalledOnce();
  });

  it('204: Cookie にトークンがない場合はブラックリスト登録されない', async () => {
    mockLogout.mockResolvedValue(undefined);
    mockCookiesGet.mockReturnValue(undefined);

    const req = new NextRequest('http://localhost/api/v1/auth/logout', { method: 'POST' });
    const res = await POST(req);

    expect(res.status).toBe(204);
    expect(mockBlacklistToken).not.toHaveBeenCalled();
    expect(mockClearSessionCookie).toHaveBeenCalledOnce();
  });

  it('204: Authorization ヘッダーなしでも成功する', async () => {
    mockLogout.mockResolvedValue(undefined);

    const req = new NextRequest('http://localhost/api/v1/auth/logout', { method: 'POST' });
    const res = await POST(req);

    expect(res.status).toBe(204);
  });

  it('500: サービスエラーは 500 を返す', async () => {
    mockLogout.mockRejectedValue(new Error('unexpected'));

    const req = new NextRequest('http://localhost/api/v1/auth/logout', { method: 'POST' });
    const res = await POST(req);

    expect(res.status).toBe(500);
  });
});
