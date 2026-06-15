// @vitest-environment node
import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { GET, POST } from './route';

vi.mock('@/services/department.service', () => ({
  listDepartments: vi.fn(),
  createDepartment: vi.fn(),
}));

vi.mock('@/lib/api/auth', () => ({
  requireAuth: vi.fn(),
  getCurrentUser: vi.fn(),
  extractBearerToken: vi.fn(),
}));

import { listDepartments, createDepartment } from '@/services/department.service';
import { requireAuth } from '@/lib/api/auth';
const mockList = listDepartments as ReturnType<typeof vi.fn>;
const mockCreate = createDepartment as ReturnType<typeof vi.fn>;
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

const baseDepartment = {
  id: 3,
  name: '東日本営業部',
  parentDepartment: { id: 1, name: '営業本部' },
  manager: { id: 8, name: '佐藤部長' },
  isActive: true,
  createdAt: '2026-01-10T09:00:00',
  updatedAt: '2026-01-10T09:00:00',
};

const pageResponse = {
  content: [baseDepartment],
  page: 0,
  size: 20,
  totalElements: 1,
  totalPages: 1,
};

function makeGetRequest(query = '') {
  return new NextRequest(`http://localhost/api/v1/departments${query}`, {
    method: 'GET',
    headers: { Authorization: 'Bearer dummy-token' },
  });
}

function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/v1/departments', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer dummy-token' },
  });
}

describe('GET /api/v1/departments', () => {
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
    expect(body.content[0].id).toBe(3);
    expect(body.totalElements).toBe(1);
  });

  it('未認証 → 401', async () => {
    const { ApiError } = await import('@/lib/api');
    mockRequireAuth.mockRejectedValue(new ApiError(401, '認証が必要です'));

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it('クエリパラメータが service に渡る', async () => {
    await GET(makeGetRequest('?name=東日本&isActive=true&parentDepartmentId=1'));

    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ name: '東日本', isActive: true, parentDepartmentId: 1 }),
      expect.any(Object)
    );
  });

  it('isActive に true/false 以外 → 400', async () => {
    const res = await GET(makeGetRequest('?isActive=invalid'));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/departments', () => {
  const validBody = {
    name: '東日本営業部',
    parentDepartmentId: 1,
    managerId: 8,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(adminUser);
    mockCreate.mockResolvedValue(baseDepartment);
  });

  it('TC-MST-021: ADMIN が部署登録 → 201', async () => {
    const res = await POST(makePostRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.name).toBe('東日本営業部');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: '東日本営業部', parentDepartmentId: 1, managerId: 8 })
    );
  });

  it('SALES が登録 → 403', async () => {
    mockRequireAuth.mockResolvedValue(salesUser);

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(403);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('部署名未入力 → 400（fieldErrors 付き）', async () => {
    const res = await POST(makePostRequest({ ...validBody, name: '' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.fieldErrors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'name' })])
    );
  });

  it('部署名101文字 → 400', async () => {
    const res = await POST(makePostRequest({ ...validBody, name: 'あ'.repeat(101) }));
    expect(res.status).toBe(400);
  });

  it('parentDepartmentId / managerId 省略でも登録できる', async () => {
    const res = await POST(makePostRequest({ name: '営業本部' }));
    expect(res.status).toBe(201);
  });
});
