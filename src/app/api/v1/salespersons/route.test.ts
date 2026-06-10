// @vitest-environment node
import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { GET, POST } from './route';

vi.mock('@/services/salesperson.service', () => ({
  listSalespersons: vi.fn(),
  createSalesperson: vi.fn(),
}));

vi.mock('@/lib/api/auth', () => ({
  requireAuth: vi.fn(),
  getCurrentUser: vi.fn(),
  extractBearerToken: vi.fn(),
}));

import { listSalespersons, createSalesperson } from '@/services/salesperson.service';
import { requireAuth } from '@/lib/api/auth';
const mockList = listSalespersons as ReturnType<typeof vi.fn>;
const mockCreate = createSalesperson as ReturnType<typeof vi.fn>;
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

const pageResponse = {
  content: [baseSalesperson],
  page: 0,
  size: 20,
  totalElements: 1,
  totalPages: 1,
};

function makeGetRequest(query = '') {
  return new NextRequest(`http://localhost/api/v1/salespersons${query}`, {
    method: 'GET',
    headers: { Authorization: 'Bearer dummy-token' },
  });
}

function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/v1/salespersons', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer dummy-token' },
  });
}

describe('GET /api/v1/salespersons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(salesUser);
    mockList.mockResolvedValue(pageResponse);
  });

  it('認証済ユーザーが一覧取得 → 200', async () => {
    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.content).toHaveLength(1);
    expect(body.content[0].id).toBe(12);
    expect(body.totalElements).toBe(1);
  });

  it('未認証 → 401', async () => {
    const { ApiError } = await import('@/lib/api');
    mockRequireAuth.mockRejectedValue(new ApiError(401, '認証が必要です'));

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it('クエリパラメータが service に渡る', async () => {
    await GET(makeGetRequest('?name=山田&role=SALES&isActive=true&departmentId=3'));

    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ name: '山田', role: 'SALES', isActive: true, departmentId: 3 }),
      expect.any(Object)
    );
  });

  it('isActive に true/false 以外 → 400', async () => {
    const res = await GET(makeGetRequest('?isActive=invalid'));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/salespersons', () => {
  const validBody = {
    name: '山田太郎',
    email: 'yamada@example.com',
    password: 'password123',
    role: 'SALES',
    departmentId: 3,
    isActive: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(adminUser);
    mockCreate.mockResolvedValue(baseSalesperson);
  });

  it('TC-MST-011: ADMIN が正常登録 → 201', async () => {
    const res = await POST(makePostRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.id).toBe(12);
    expect(body.department).toEqual({ id: 3, name: '東日本営業部' });
  });

  it('TC-MST-012: email重複 → 409', async () => {
    const { ApiError } = await import('@/lib/api');
    mockCreate.mockRejectedValue(new ApiError(409, 'このメールアドレスはすでに使用されています'));

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(409);
  });

  it('TC-MST-013: email形式不正 → 400', async () => {
    const res = await POST(makePostRequest({ ...validBody, email: 'not-an-email' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.fieldErrors.some((e: { field: string }) => e.field === 'email')).toBe(true);
  });

  it('TC-MST-014: role不正値 → 400', async () => {
    const res = await POST(makePostRequest({ ...validBody, role: 'INVALID' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.fieldErrors.some((e: { field: string }) => e.field === 'role')).toBe(true);
  });

  it('name未入力 → 400', async () => {
    const res = await POST(makePostRequest({ ...validBody, name: '' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.fieldErrors.some((e: { field: string }) => e.field === 'name')).toBe(true);
  });

  it('departmentId未入力 → 400', async () => {
    const { name, email, password, role, isActive } = validBody;
    const res = await POST(makePostRequest({ name, email, password, role, isActive }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.fieldErrors.some((e: { field: string }) => e.field === 'departmentId')).toBe(true);
  });

  it('password未入力 → 400', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _pw, ...bodyWithoutPassword } = validBody;
    const res = await POST(makePostRequest(bodyWithoutPassword));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.fieldErrors.some((e: { field: string }) => e.field === 'password')).toBe(true);
  });

  it('SALES ロール → 403', async () => {
    mockRequireAuth.mockResolvedValue(salesUser);

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(403);
  });

  it('未認証 → 401', async () => {
    const { ApiError } = await import('@/lib/api');
    mockRequireAuth.mockRejectedValue(new ApiError(401, '認証が必要です'));

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(401);
  });
});
