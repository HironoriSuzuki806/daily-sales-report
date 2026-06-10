// @vitest-environment node
import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { GET, PUT, DELETE } from './route';

vi.mock('@/services/customer.service', () => ({
  getCustomer: vi.fn(),
  updateCustomer: vi.fn(),
  deactivateCustomer: vi.fn(),
}));

vi.mock('@/lib/api/auth', () => ({
  requireAuth: vi.fn(),
  getCurrentUser: vi.fn(),
  extractBearerToken: vi.fn(),
}));

import { getCustomer, updateCustomer, deactivateCustomer } from '@/services/customer.service';
import { requireAuth } from '@/lib/api/auth';
const mockGetCustomer = getCustomer as ReturnType<typeof vi.fn>;
const mockUpdateCustomer = updateCustomer as ReturnType<typeof vi.fn>;
const mockDeactivateCustomer = deactivateCustomer as ReturnType<typeof vi.fn>;
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

function makeRequest(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/v1/customers/30', {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      Authorization: 'Bearer dummy-token',
    },
  });
}

function makeContext(id = '30') {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/v1/customers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(salesUser);
    mockGetCustomer.mockResolvedValue(baseCustomer);
  });

  it('認証済みユーザーが詳細取得 → 200', async () => {
    const res = await GET(makeRequest('GET'), makeContext());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.id).toBe(30);
    expect(body.name).toBe('ABC商事');
  });

  it('存在しない顧客 → 404', async () => {
    const { ApiError } = await import('@/lib/api');
    mockGetCustomer.mockRejectedValue(new ApiError(404, '顧客が見つかりません'));
    const res = await GET(makeRequest('GET'), makeContext());
    expect(res.status).toBe(404);
  });

  it('未認証 → 401', async () => {
    const { ApiError } = await import('@/lib/api');
    mockRequireAuth.mockRejectedValue(new ApiError(401, '認証が必要です'));
    const res = await GET(makeRequest('GET'), makeContext());
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/v1/customers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(adminUser);
    mockUpdateCustomer.mockResolvedValue(baseCustomer);
  });

  it('ADMINが顧客更新 → 200', async () => {
    const res = await PUT(makeRequest('PUT', { name: 'ABC商事改', isActive: true }), makeContext());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.name).toBe('ABC商事');
  });

  it('name未入力 → 400', async () => {
    const res = await PUT(makeRequest('PUT', { isActive: true }), makeContext());
    expect(res.status).toBe(400);
  });

  it('SALES ロール → 403', async () => {
    mockRequireAuth.mockResolvedValue(salesUser);
    const res = await PUT(makeRequest('PUT', { name: 'ABC商事' }), makeContext());
    expect(res.status).toBe(403);
  });

  it('存在しない顧客 → 404', async () => {
    const { ApiError } = await import('@/lib/api');
    mockUpdateCustomer.mockRejectedValue(new ApiError(404, '顧客が見つかりません'));
    const res = await PUT(makeRequest('PUT', { name: 'ABC商事' }), makeContext());
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/v1/customers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(adminUser);
    mockDeactivateCustomer.mockResolvedValue(undefined);
  });

  it('TC-MST-003: ADMIN が論理削除 → 204', async () => {
    const res = await DELETE(makeRequest('DELETE'), makeContext());
    expect(res.status).toBe(204);
    expect(mockDeactivateCustomer).toHaveBeenCalledWith(30);
  });

  it('SALES ロール → 403', async () => {
    mockRequireAuth.mockResolvedValue(salesUser);
    const res = await DELETE(makeRequest('DELETE'), makeContext());
    expect(res.status).toBe(403);
  });

  it('存在しない顧客 → 404', async () => {
    const { ApiError } = await import('@/lib/api');
    mockDeactivateCustomer.mockRejectedValue(new ApiError(404, '顧客が見つかりません'));
    const res = await DELETE(makeRequest('DELETE'), makeContext());
    expect(res.status).toBe(404);
  });
});
