// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { listCustomers } from './customer.service';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    salesperson: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
const mockFindMany = prisma.customer.findMany as ReturnType<typeof vi.fn>;
const mockTransaction = prisma.$transaction as ReturnType<typeof vi.fn>;

const now = new Date('2026-06-04T10:00:00Z');

function makeMockCustomer(overrides = {}) {
  return {
    id: BigInt(30),
    name: 'ABC商事',
    address: '東京都千代田区',
    phone: '03-1234-5678',
    salesRepId: BigInt(12),
    isActive: true,
    createdAt: now,
    updatedAt: now,
    salesRep: { id: BigInt(12), name: '山田太郎' },
    ...overrides,
  };
}

describe('TC-MST-005: listCustomers - 部分一致検索', () => {
  beforeEach(() => vi.clearAllMocks());

  it('name 部分一致: "ABC" で検索すると where.name に contains が設定される', async () => {
    mockTransaction.mockResolvedValue([1, [makeMockCustomer()]]);

    const result = await listCustomers({ name: 'ABC' }, { page: 0, size: 20 });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ name: { contains: 'ABC', mode: 'insensitive' } }),
      })
    );
    expect(result.content[0].name).toBe('ABC商事');
  });

  it('name 未指定のとき where.name は設定されない', async () => {
    mockTransaction.mockResolvedValue([0, []]);

    await listCustomers({}, { page: 0, size: 20 });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.not.objectContaining({ name: expect.anything() }) })
    );
  });
});

describe('listCustomers - sort', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sort 未指定のとき id,asc がデフォルト orderBy になる', async () => {
    mockTransaction.mockResolvedValue([1, [makeMockCustomer()]]);

    await listCustomers({}, { page: 0, size: 20, sort: undefined });

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { id: 'asc' } }));
  });

  it('sort: "name,desc" を orderBy に反映する', async () => {
    mockTransaction.mockResolvedValue([1, [makeMockCustomer()]]);

    await listCustomers({}, { page: 0, size: 20, sort: 'name,desc' });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { name: 'desc' } })
    );
  });

  it('sort: "createdAt,asc" を orderBy に反映する', async () => {
    mockTransaction.mockResolvedValue([1, [makeMockCustomer()]]);

    await listCustomers({}, { page: 0, size: 20, sort: 'createdAt,asc' });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'asc' } })
    );
  });

  it('sort に許可外フィールドを指定 → 400 ApiError', async () => {
    const { ApiError } = await import('@/lib/api');
    await expect(listCustomers({}, { page: 0, size: 20, sort: 'email,asc' })).rejects.toThrow(
      ApiError
    );
  });

  it('sort の方向が不正 → 400 ApiError', async () => {
    const { ApiError } = await import('@/lib/api');
    await expect(listCustomers({}, { page: 0, size: 20, sort: 'name,DESC' })).rejects.toThrow(
      ApiError
    );
  });
});
