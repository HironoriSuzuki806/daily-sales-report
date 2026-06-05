// @vitest-environment node
import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { GET } from './route';

vi.mock('@/services/auth.service', () => ({
  getMe: vi.fn(),
}));

import { getMe } from '@/services/auth.service';
const mockGetMe = getMe as ReturnType<typeof vi.fn>;

describe('GET /api/v1/me', () => {
  beforeEach(() => vi.clearAllMocks());

  it('200: 有効なトークンでユーザー情報を返す', async () => {
    const meResult = {
      id: 12,
      name: '山田太郎',
      email: 'yamada@example.com',
      role: 'SALES',
      department: { id: 3, name: '東日本営業部' },
    };
    mockGetMe.mockResolvedValue(meResult);

    const req = new NextRequest('http://localhost/api/v1/me', {
      headers: { Authorization: 'Bearer valid-token' },
    });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe(12);
    expect(body.name).toBe('山田太郎');
    expect(body.department.id).toBe(3);
  });

  it('401: AuthError は 401 を返す', async () => {
    const { AuthError } = await import('@/lib/auth');
    mockGetMe.mockRejectedValue(new AuthError('トークンが無効または期限切れです'));

    const req = new NextRequest('http://localhost/api/v1/me', {
      headers: { Authorization: 'Bearer invalid-token' },
    });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.message).toBe('トークンが無効または期限切れです');
  });

  it('401: Authorization ヘッダーなしは 401 を返す', async () => {
    const { AuthError } = await import('@/lib/auth');
    mockGetMe.mockRejectedValue(new AuthError('トークンが提供されていません'));

    const req = new NextRequest('http://localhost/api/v1/me');
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('500: 予期しないエラーは 500 を返す', async () => {
    mockGetMe.mockRejectedValue(new Error('DB error'));

    const req = new NextRequest('http://localhost/api/v1/me', {
      headers: { Authorization: 'Bearer token' },
    });
    const res = await GET(req);

    expect(res.status).toBe(500);
  });
});
