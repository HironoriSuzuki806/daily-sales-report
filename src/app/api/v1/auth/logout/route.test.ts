// @vitest-environment node
import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { POST } from './route';

vi.mock('@/services/auth.service', () => ({
  logout: vi.fn(),
}));

// `clearSessionCookie` calls `next/headers` cookies(), which is unavailable
// outside a real Next.js request context. Mock the entire session module.
vi.mock('@/lib/session', () => ({
  clearSessionCookie: vi.fn().mockResolvedValue(undefined),
  setSessionCookie: vi.fn().mockResolvedValue(undefined),
  getSessionUser: vi.fn().mockResolvedValue(null),
}));

import { logout } from '@/services/auth.service';
const mockLogout = logout as ReturnType<typeof vi.fn>;

describe('POST /api/v1/auth/logout', () => {
  beforeEach(() => vi.clearAllMocks());

  it('204: 正常ログアウト', async () => {
    mockLogout.mockResolvedValue(undefined);

    const req = new NextRequest('http://localhost/api/v1/auth/logout', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
    });
    const res = await POST(req);

    expect(res.status).toBe(204);
    expect(mockLogout).toHaveBeenCalledOnce();
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
