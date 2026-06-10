// @vitest-environment node
import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { GET, POST } from './route';

vi.mock('@/services/customer.service', () => ({
  listCustomers: vi.fn(),
  createCustomer: vi.fn(),
}));

vi.mock('@/lib/api/auth', () => ({
  requireAuth: vi.fn(),
  getCurrentUser: vi.fn(),
  extractBearerToken: vi.fn(),
}));

import { listCustomers, createCustomer } from '@/services/customer.service';
import { requireAuth } from '@/lib/api/auth';
const mockListCustomers = listCustomers as ReturnType<typeof vi.fn>;
const mockCreateCustomer = createCustomer as ReturnType<typeof vi.fn>;
const mockRequireAuth = requireAuth as ReturnType<typeof vi.fn>;

const adminUser = {
  id: 1,
  name: '管理者',
  email: 'admin@example.com',
  role: 'ADMIN' as const,
  departmentId: null,
};
const salesUser = {
  id: 12,
  name: '山田太郎',
  email: 'yamada@example.com',
  role: 'SALES' as const,
  departmentId: 3,
};

const baseCustomer = {
  id: 30,
  name: 'ABC商事',
  address: '東京都千代田区...',
  phone: '03-1234-5678',
  salesRep: { id: 12, name: '山田太郎' },
  isActive: true,
  createdAt: '2026-01-10T09:00:00Z',
  updatedAt: '2026-01-10T09:00:00Z',
};

const pageResponse = {
  content: [baseCustomer],
  page: 0,
  size: 20,
  totalElements: 1,
  totalPages: 1,
};

function makeGetRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/v1/customers');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url, { headers: { Authorization: 'Bearer dummy-token' } });
}

function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/v1/customers', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer dummy-token' },
  });
}

describe('GET /api/v1/customers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(salesUser);
    mockListCustomers.mockResolvedValue(pageResponse);
  });

  it('TC-MST-001系: 認証済みユーザーが一覧を取得できる → 200', async () => {
    const res = await GET(makeGetRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.content).toHaveLength(1);
    expect(body.content[0].name).toBe('ABC商事');
  });

  it('name クエリで絞り込み呼び出し', async () => {
    await GET(makeGetRequest({ name: 'ABC' }));
    expect(mockListCustomers).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'ABC' }),
      expect.any(Object)
    );
  });

  it('isActive=false クエリで絞り込み呼び出し', async () => {
    await GET(makeGetRequest({ isActive: 'false' }));
    expect(mockListCustomers).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: false }),
      expect.any(Object)
    );
  });

  it('salesRepId クエリで絞り込み呼び出し', async () => {
    await GET(makeGetRequest({ salesRepId: '12' }));
    expect(mockListCustomers).toHaveBeenCalledWith(
      expect.objectContaining({ salesRepId: 12 }),
      expect.any(Object)
    );
  });

  it('未認証 → 401', async () => {
    const { ApiError } = await import('@/lib/api');
    mockRequireAuth.mockRejectedValue(new ApiError(401, '認証が必要です'));
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/customers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(adminUser);
    mockCreateCustomer.mockResolvedValue(baseCustomer);
  });

  it('TC-MST-001: ADMINが顧客登録 → 201', async () => {
    const res = await POST(makePostRequest({ name: 'ABC商事', isActive: true }));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.name).toBe('ABC商事');
  });

  it('TC-MST-002: name未入力 → 400', async () => {
    const res = await POST(makePostRequest({ isActive: true }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.fieldErrors?.some((e: { field: string }) => e.field === 'name')).toBe(true);
  });

  it('name が101文字 → 400', async () => {
    const res = await POST(makePostRequest({ name: 'a'.repeat(101) }));
    expect(res.status).toBe(400);
  });

  it('phone に不正文字 → 400', async () => {
    const res = await POST(makePostRequest({ name: 'ABC', phone: '03-1234-ABCD' }));
    expect(res.status).toBe(400);
  });

  it('TC-MST-004: SALES ロールが登録 → 403', async () => {
    mockRequireAuth.mockResolvedValue(salesUser);
    const res = await POST(makePostRequest({ name: 'ABC商事' }));
    expect(res.status).toBe(403);
  });

  it('address が空文字 → 400', async () => {
    const res = await POST(makePostRequest({ name: 'ABC商事', address: '' }));
    expect(res.status).toBe(400);
  });

  it('存在しない salesRepId 指定 → 400', async () => {
    const { ApiError } = await import('@/lib/api');
    mockCreateCustomer.mockRejectedValue(new ApiError(400, '指定された担当営業が見つかりません'));
    const res = await POST(makePostRequest({ name: 'ABC商事', salesRepId: 99999 }));
    expect(res.status).toBe(400);
  });
});
