// @vitest-environment node
import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { GET, PUT, DELETE } from './route';

vi.mock('@/services/salesperson.service', () => ({
  getSalesperson: vi.fn(),
  updateSalesperson: vi.fn(),
  deleteSalesperson: vi.fn(),
}));

vi.mock('@/lib/api/auth', () => ({
  requireAuth: vi.fn(),
  getCurrentUser: vi.fn(),
  extractBearerToken: vi.fn(),
}));

import {
  getSalesperson,
  updateSalesperson,
  deleteSalesperson,
} from '@/services/salesperson.service';
import { requireAuth } from '@/lib/api/auth';
const mockGet = getSalesperson as ReturnType<typeof vi.fn>;
const mockUpdate = updateSalesperson as ReturnType<typeof vi.fn>;
const mockDelete = deleteSalesperson as ReturnType<typeof vi.fn>;
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

const baseSalesperson = {
  id: 12,
  name: '山田太郎',
  email: 'yamada@example.com',
  role: 'SALES',
  department: { id: 3, name: '東日本営業部' },
  isActive: true,
  createdAt: '2026-01-10T09:00:00',
  updatedAt: '2026-01-10T09:00:00',
};

const validBody = {
  name: '山田太郎',
  email: 'yamada@example.com',
  password: 'password123',
  role: 'SALES',
  departmentId: 3,
  isActive: true,
};

function makeContext(id = '12') {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(method: string, body?: unknown) {
  return new NextRequest(`http://localhost/api/v1/salespersons/12`, {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer dummy-token' },
  });
}

describe('GET /api/v1/salespersons/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(adminUser);
    mockGet.mockResolvedValue(baseSalesperson);
  });

  it('ADMIN が詳細取得 → 200', async () => {
    const res = await GET(makeRequest('GET'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe(12);
    expect(body.department).toEqual({ id: 3, name: '東日本営業部' });
  });

  it('存在しないID → 404', async () => {
    const { ApiError } = await import('@/lib/api');
    mockGet.mockRejectedValue(new ApiError(404, '営業が見つかりません'));

    const res = await GET(makeRequest('GET'), makeContext('999'));
    expect(res.status).toBe(404);
  });

  it('SALES ロール → 403', async () => {
    mockRequireAuth.mockResolvedValue(salesUser);

    const res = await GET(makeRequest('GET'), makeContext());
    expect(res.status).toBe(403);
  });

  it('IDが非数値 → 400', async () => {
    const res = await GET(makeRequest('GET'), makeContext('abc'));
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/v1/salespersons/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(adminUser);
    mockUpdate.mockResolvedValue(baseSalesperson);
  });

  it('ADMIN が正常更新 → 200', async () => {
    const res = await PUT(makeRequest('PUT', validBody), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe(12);
  });

  it('email重複 → 409', async () => {
    const { ApiError } = await import('@/lib/api');
    mockUpdate.mockRejectedValue(new ApiError(409, 'このメールアドレスはすでに使用されています'));

    const res = await PUT(makeRequest('PUT', validBody), makeContext());
    expect(res.status).toBe(409);
  });

  it('存在しないID → 404', async () => {
    const { ApiError } = await import('@/lib/api');
    mockUpdate.mockRejectedValue(new ApiError(404, '営業が見つかりません'));

    const res = await PUT(makeRequest('PUT', validBody), makeContext('999'));
    expect(res.status).toBe(404);
  });

  it('SALES ロール → 403', async () => {
    mockRequireAuth.mockResolvedValue(salesUser);

    const res = await PUT(makeRequest('PUT', validBody), makeContext());
    expect(res.status).toBe(403);
  });

  it('IDが非数値 → 400', async () => {
    const res = await PUT(makeRequest('PUT', validBody), makeContext('abc'));
    expect(res.status).toBe(400);
  });

  it('role不正値 → 400', async () => {
    const res = await PUT(makeRequest('PUT', { ...validBody, role: 'INVALID' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.fieldErrors.some((e: { field: string }) => e.field === 'role')).toBe(true);
  });
});

describe('DELETE /api/v1/salespersons/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(adminUser);
    mockDelete.mockResolvedValue(undefined);
  });

  it('TC-MST-015: ADMIN が論理削除 → 204', async () => {
    const res = await DELETE(makeRequest('DELETE'), makeContext());

    expect(res.status).toBe(204);
    expect(mockDelete).toHaveBeenCalledWith(12);
  });

  it('存在しないID → 404', async () => {
    const { ApiError } = await import('@/lib/api');
    mockDelete.mockRejectedValue(new ApiError(404, '営業が見つかりません'));

    const res = await DELETE(makeRequest('DELETE'), makeContext('999'));
    expect(res.status).toBe(404);
  });

  it('SALES ロール → 403', async () => {
    mockRequireAuth.mockResolvedValue(salesUser);

    const res = await DELETE(makeRequest('DELETE'), makeContext());
    expect(res.status).toBe(403);
  });

  it('未認証 → 401', async () => {
    const { ApiError } = await import('@/lib/api');
    mockRequireAuth.mockRejectedValue(new ApiError(401, '認証が必要です'));

    const res = await DELETE(makeRequest('DELETE'), makeContext());
    expect(res.status).toBe(401);
  });

  it('IDが非数値 → 400', async () => {
    const res = await DELETE(makeRequest('DELETE'), makeContext('abc'));
    expect(res.status).toBe(400);
  });
});
