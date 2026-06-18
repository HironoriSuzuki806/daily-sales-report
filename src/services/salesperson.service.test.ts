// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { listSalespersons } from './salesperson.service';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    salesperson: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
const mockFindMany = prisma.salesperson.findMany as ReturnType<typeof vi.fn>;
const mockTransaction = prisma.$transaction as ReturnType<typeof vi.fn>;

const now = new Date('2026-06-04T10:00:00Z');

function makeMockSalesperson(overrides = {}) {
  return {
    id: BigInt(12),
    name: '山田太郎',
    email: 'yamada@example.com',
    role: 'SALES' as const,
    departmentId: BigInt(3),
    isActive: true,
    createdAt: now,
    updatedAt: now,
    department: { id: BigInt(3), name: '東日本営業部' },
    ...overrides,
  };
}

describe('listSalespersons - sort', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sort 未指定のとき id,asc がデフォルト orderBy になる', async () => {
    mockTransaction.mockResolvedValue([1, [makeMockSalesperson()]]);

    await listSalespersons({ isActive: undefined }, { page: 0, size: 20, sort: undefined });

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { id: 'asc' } }));
  });

  it('sort: "name,asc" を orderBy に反映する', async () => {
    mockTransaction.mockResolvedValue([1, [makeMockSalesperson()]]);

    await listSalespersons({ isActive: undefined }, { page: 0, size: 20, sort: 'name,asc' });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { name: 'asc' } })
    );
  });

  it('sort: "email,desc" を orderBy に反映する (email は salesperson 専用フィールド)', async () => {
    mockTransaction.mockResolvedValue([1, [makeMockSalesperson()]]);

    await listSalespersons({ isActive: undefined }, { page: 0, size: 20, sort: 'email,desc' });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { email: 'desc' } })
    );
  });

  it('sort に許可外フィールドを指定 → 400 ApiError', async () => {
    const { ApiError } = await import('@/lib/api');
    await expect(
      listSalespersons({ isActive: undefined }, { page: 0, size: 20, sort: 'password,asc' })
    ).rejects.toThrow(ApiError);
  });

  it('sort の方向が不正 → 400 ApiError', async () => {
    const { ApiError } = await import('@/lib/api');
    await expect(
      listSalespersons({ isActive: undefined }, { page: 0, size: 20, sort: 'name,ascending' })
    ).rejects.toThrow(ApiError);
  });
});
