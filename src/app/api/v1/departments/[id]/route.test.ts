// @vitest-environment node
import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { GET, PUT, DELETE } from './route';

vi.mock('@/services/department.service', () => ({
  getDepartment: vi.fn(),
  updateDepartment: vi.fn(),
  deleteDepartment: vi.fn(),
}));

vi.mock('@/lib/api/auth', () => ({
  requireAuth: vi.fn(),
  getCurrentUser: vi.fn(),
  extractBearerToken: vi.fn(),
}));

import { getDepartment, updateDepartment, deleteDepartment } from '@/services/department.service';
import { requireAuth } from '@/lib/api/auth';
const mockGet = getDepartment as ReturnType<typeof vi.fn>;
const mockUpdate = updateDepartment as ReturnType<typeof vi.fn>;
const mockDelete = deleteDepartment as ReturnType<typeof vi.fn>;
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

const validBody = {
  name: '東日本営業部',
  parentDepartmentId: 1,
  managerId: 8,
  isActive: true,
};

function makeContext(id = '3') {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(method: string, body?: unknown) {
  return new NextRequest(`http://localhost/api/v1/departments/3`, {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer dummy-token' },
  });
}

describe('GET /api/v1/departments/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(adminUser);
    mockGet.mockResolvedValue(baseDepartment);
  });

  it('ADMIN が詳細取得 → 200', async () => {
    const res = await GET(makeRequest('GET'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe(3);
    expect(body.parentDepartment).toEqual({ id: 1, name: '営業本部' });
    expect(body.manager).toEqual({ id: 8, name: '佐藤部長' });
  });

  it('SALES → 403', async () => {
    mockRequireAuth.mockResolvedValue(salesUser);

    const res = await GET(makeRequest('GET'), makeContext());
    expect(res.status).toBe(403);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('不正な ID → 400', async () => {
    const res = await GET(makeRequest('GET'), makeContext('abc'));
    expect(res.status).toBe(400);
  });

  it('存在しない部署 → 404', async () => {
    const { ApiError } = await import('@/lib/api');
    mockGet.mockRejectedValue(new ApiError(404, '部署が見つかりません'));

    const res = await GET(makeRequest('GET'), makeContext('999'));
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/v1/departments/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(adminUser);
    mockUpdate.mockResolvedValue(baseDepartment);
  });

  it('ADMIN が更新 → 200', async () => {
    const res = await PUT(makeRequest('PUT', validBody), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.name).toBe('東日本営業部');
    expect(mockUpdate).toHaveBeenCalledWith(3, expect.objectContaining({ name: '東日本営業部' }));
  });

  it('SALES → 403', async () => {
    mockRequireAuth.mockResolvedValue(salesUser);

    const res = await PUT(makeRequest('PUT', validBody), makeContext());
    expect(res.status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('部署名未入力 → 400', async () => {
    const res = await PUT(makeRequest('PUT', { ...validBody, name: '' }), makeContext());
    expect(res.status).toBe(400);
  });

  it('TC-MST-022: 自部署を上位部署に指定 → 400（service がエラー）', async () => {
    const { ApiError } = await import('@/lib/api');
    mockUpdate.mockRejectedValue(new ApiError(400, '上位部署に自部署は指定できません'));

    const res = await PUT(
      makeRequest('PUT', { ...validBody, parentDepartmentId: 3 }),
      makeContext()
    );
    expect(res.status).toBe(400);
  });

  it('TC-MST-023: 階層の循環設定 → 400（service がエラー）', async () => {
    const { ApiError } = await import('@/lib/api');
    mockUpdate.mockRejectedValue(new ApiError(400, '部署の階層が循環しています'));

    const res = await PUT(makeRequest('PUT', validBody), makeContext());
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/v1/departments/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(adminUser);
    mockDelete.mockResolvedValue(undefined);
  });

  it('ADMIN が削除（論理削除） → 204', async () => {
    const res = await DELETE(makeRequest('DELETE'), makeContext());

    expect(res.status).toBe(204);
    expect(mockDelete).toHaveBeenCalledWith(3);
  });

  it('SALES → 403', async () => {
    mockRequireAuth.mockResolvedValue(salesUser);

    const res = await DELETE(makeRequest('DELETE'), makeContext());
    expect(res.status).toBe(403);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('存在しない部署 → 404', async () => {
    const { ApiError } = await import('@/lib/api');
    mockDelete.mockRejectedValue(new ApiError(404, '部署が見つかりません'));

    const res = await DELETE(makeRequest('DELETE'), makeContext('999'));
    expect(res.status).toBe(404);
  });
});
