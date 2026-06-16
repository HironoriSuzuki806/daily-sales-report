// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  listDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from './department.service';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    department: {
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
const mockDeptFindUnique = prisma.department.findUnique as ReturnType<typeof vi.fn>;
const mockDeptCreate = prisma.department.create as ReturnType<typeof vi.fn>;
const mockDeptUpdate = prisma.department.update as ReturnType<typeof vi.fn>;
const mockSalespersonFindUnique = prisma.salesperson.findUnique as ReturnType<typeof vi.fn>;
const mockTransaction = prisma.$transaction as ReturnType<typeof vi.fn>;

const now = new Date('2026-06-04T10:00:00Z');

function makeMockDepartment(overrides = {}) {
  return {
    id: BigInt(3),
    name: '東日本営業部',
    parentDepartmentId: BigInt(1),
    managerId: BigInt(8),
    isActive: true,
    createdAt: now,
    updatedAt: now,
    parentDepartment: { id: BigInt(1), name: '営業本部' },
    manager: { id: BigInt(8), name: '佐藤部長' },
    ...overrides,
  };
}

describe('listDepartments', () => {
  beforeEach(() => vi.clearAllMocks());

  it('一覧をページング形式で返す', async () => {
    mockTransaction.mockResolvedValue([1, [makeMockDepartment()]]);

    const result = await listDepartments(
      { isActive: undefined },
      { page: 0, size: 20, sort: undefined }
    );

    expect(result.totalElements).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.content[0]).toMatchObject({
      id: 3,
      name: '東日本営業部',
      parentDepartment: { id: 1, name: '営業本部' },
      manager: { id: 8, name: '佐藤部長' },
      isActive: true,
    });
  });

  it('parentDepartment / manager が null の部署も返せる', async () => {
    mockTransaction.mockResolvedValue([
      1,
      [
        makeMockDepartment({
          parentDepartmentId: null,
          managerId: null,
          parentDepartment: null,
          manager: null,
        }),
      ],
    ]);

    const result = await listDepartments(
      { isActive: undefined },
      { page: 0, size: 20, sort: undefined }
    );

    expect(result.content[0].parentDepartment).toBeNull();
    expect(result.content[0].manager).toBeNull();
  });
});

describe('getDepartment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('存在する部署 → 詳細を返す', async () => {
    mockDeptFindUnique.mockResolvedValue(makeMockDepartment());

    const result = await getDepartment(3);

    expect(result.id).toBe(3);
    expect(result.name).toBe('東日本営業部');
  });

  it('存在しない部署 → 404', async () => {
    mockDeptFindUnique.mockResolvedValue(null);

    await expect(getDepartment(999)).rejects.toMatchObject({ status: 404 });
  });
});

describe('createDepartment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('TC-MST-021: 部署名のみで登録できる', async () => {
    mockDeptCreate.mockResolvedValue(
      makeMockDepartment({
        parentDepartmentId: null,
        managerId: null,
        parentDepartment: null,
        manager: null,
      })
    );

    const result = await createDepartment({ name: '東日本営業部', isActive: true });

    expect(result.name).toBe('東日本営業部');
    expect(mockDeptCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: '東日本営業部',
          parentDepartmentId: null,
          managerId: null,
          isActive: true,
        }),
      })
    );
  });

  it('TC-MST-024: 既存営業を部署長に設定して登録できる', async () => {
    mockSalespersonFindUnique.mockResolvedValue({ id: BigInt(8) });
    mockDeptCreate.mockResolvedValue(makeMockDepartment());

    const result = await createDepartment({
      name: '東日本営業部',
      parentDepartmentId: undefined,
      managerId: 8,
      isActive: true,
    });

    expect(result.manager).toEqual({ id: 8, name: '佐藤部長' });
    expect(mockDeptCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ managerId: BigInt(8) }),
      })
    );
  });

  it('TC-MST-025: 存在しない部署長を指定 → 400', async () => {
    mockSalespersonFindUnique.mockResolvedValue(null);

    await expect(
      createDepartment({ name: '東日本営業部', managerId: 999, isActive: true })
    ).rejects.toMatchObject({ status: 400 });
    expect(mockDeptCreate).not.toHaveBeenCalled();
  });

  it('論理削除済み営業（isActive=false）を部署長に指定 → 400', async () => {
    // isActive: true でフィルタされるため null が返る想定
    mockSalespersonFindUnique.mockResolvedValue(null);

    await expect(
      createDepartment({ name: '東日本営業部', managerId: 8, isActive: true })
    ).rejects.toMatchObject({ status: 400 });
    expect(mockDeptCreate).not.toHaveBeenCalled();
    // isActive: true のフィルタが where 条件に含まれることを確認
    expect(mockSalespersonFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      })
    );
  });

  it('存在しない上位部署を指定 → 400', async () => {
    mockDeptFindUnique.mockResolvedValue(null);

    await expect(
      createDepartment({ name: '東日本営業部', parentDepartmentId: 999, isActive: true })
    ).rejects.toMatchObject({ status: 400 });
    expect(mockDeptCreate).not.toHaveBeenCalled();
  });

  it('論理削除済み部署（isActive=false）を上位部署に指定 → 400', async () => {
    // isActive: true でフィルタされるため null が返る想定
    mockDeptFindUnique.mockResolvedValue(null);

    await expect(
      createDepartment({ name: '東日本営業部', parentDepartmentId: 1, isActive: true })
    ).rejects.toMatchObject({ status: 400 });
    expect(mockDeptCreate).not.toHaveBeenCalled();
    // isActive: true のフィルタが where 条件に含まれることを確認
    expect(mockDeptFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      })
    );
  });

  it('上位部署を指定して登録できる', async () => {
    mockDeptFindUnique.mockResolvedValue({ id: BigInt(1), parentDepartmentId: null });
    mockDeptCreate.mockResolvedValue(makeMockDepartment());

    const result = await createDepartment({
      name: '東日本営業部',
      parentDepartmentId: 1,
      isActive: true,
    });

    expect(result.parentDepartment).toEqual({ id: 1, name: '営業本部' });
  });
});

describe('updateDepartment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('部署を更新できる', async () => {
    mockDeptFindUnique.mockResolvedValue({ id: BigInt(3) });
    mockDeptUpdate.mockResolvedValue(
      makeMockDepartment({
        name: '東日本第一営業部',
        parentDepartmentId: null,
        managerId: null,
        parentDepartment: null,
        manager: null,
      })
    );

    const result = await updateDepartment(3, { name: '東日本第一営業部' });

    expect(result.name).toBe('東日本第一営業部');
    expect(mockDeptUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BigInt(3) },
        data: expect.objectContaining({ name: '東日本第一営業部' }),
      })
    );
  });

  it('存在しない部署の更新 → 404', async () => {
    mockDeptFindUnique.mockResolvedValue(null);

    await expect(updateDepartment(999, { name: 'X' })).rejects.toMatchObject({ status: 404 });
  });

  it('TC-MST-022: 自部署を上位部署に指定 → 400', async () => {
    mockDeptFindUnique.mockResolvedValue({ id: BigInt(3) });

    await expect(
      updateDepartment(3, { name: '東日本営業部', parentDepartmentId: 3 })
    ).rejects.toMatchObject({ status: 400 });
    expect(mockDeptUpdate).not.toHaveBeenCalled();
  });

  it('論理削除済み営業（isActive=false）を部署長に指定 → 400', async () => {
    // 既存部署は存在する
    mockDeptFindUnique.mockResolvedValue({ id: BigInt(3) });
    // isActive: true でフィルタされるため null が返る想定
    mockSalespersonFindUnique.mockResolvedValue(null);

    await expect(updateDepartment(3, { name: '東日本営業部', managerId: 8 })).rejects.toMatchObject(
      { status: 400 }
    );
    expect(mockDeptUpdate).not.toHaveBeenCalled();
    // isActive: true のフィルタが where 条件に含まれることを確認
    expect(mockSalespersonFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      })
    );
  });

  it('論理削除済み部署（isActive=false）を上位部署に指定 → 400', async () => {
    // 1回目: 既存部署の存在確認 / 2回目: 上位部署の存在確認（isActive: true で null が返る）
    mockDeptFindUnique.mockResolvedValueOnce({ id: BigInt(3) }).mockResolvedValueOnce(null);

    await expect(
      updateDepartment(3, { name: '東日本営業部', parentDepartmentId: 1 })
    ).rejects.toMatchObject({ status: 400 });
    expect(mockDeptUpdate).not.toHaveBeenCalled();
    // 2回目の呼び出しに isActive: true フィルタが含まれることを確認
    expect(mockDeptFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      })
    );
  });

  it('TC-MST-023: 階層の循環設定（A→B→A） → 400', async () => {
    // 部署A(id=1) の親に 部署B(id=2) を設定。B の親は A → 循環。
    mockDeptFindUnique.mockImplementation(({ where }: { where: { id: bigint } }) => {
      if (where.id === BigInt(1)) {
        return Promise.resolve({ id: BigInt(1), parentDepartmentId: null });
      }
      if (where.id === BigInt(2)) {
        return Promise.resolve({ id: BigInt(2), parentDepartmentId: BigInt(1) });
      }
      return Promise.resolve(null);
    });

    await expect(
      updateDepartment(1, { name: '部署A', parentDepartmentId: 2 })
    ).rejects.toMatchObject({ status: 400 });
    expect(mockDeptUpdate).not.toHaveBeenCalled();
  });

  it('多段階層の循環（A→B→C→A） → 400', async () => {
    // A(id=1) の親に C(id=3) を設定。C の親は B(id=2)、B の親は A → 循環。
    mockDeptFindUnique.mockImplementation(({ where }: { where: { id: bigint } }) => {
      if (where.id === BigInt(1)) {
        return Promise.resolve({ id: BigInt(1), parentDepartmentId: null });
      }
      if (where.id === BigInt(2)) {
        return Promise.resolve({ id: BigInt(2), parentDepartmentId: BigInt(1) });
      }
      if (where.id === BigInt(3)) {
        return Promise.resolve({ id: BigInt(3), parentDepartmentId: BigInt(2) });
      }
      return Promise.resolve(null);
    });

    await expect(
      updateDepartment(1, { name: '部署A', parentDepartmentId: 3 })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('循環しない親変更は許可される', async () => {
    // B(id=2) の親に A(id=1) を設定。A の親は null → 循環なし。
    mockDeptFindUnique.mockImplementation(({ where }: { where: { id: bigint } }) => {
      if (where.id === BigInt(1)) {
        return Promise.resolve({ id: BigInt(1), parentDepartmentId: null });
      }
      if (where.id === BigInt(2)) {
        return Promise.resolve({ id: BigInt(2), parentDepartmentId: null });
      }
      return Promise.resolve(null);
    });
    mockDeptUpdate.mockResolvedValue(
      makeMockDepartment({
        id: BigInt(2),
        parentDepartmentId: BigInt(1),
        managerId: null,
        manager: null,
      })
    );

    const result = await updateDepartment(2, { name: '東日本営業部', parentDepartmentId: 1 });

    expect(result.parentDepartment).toEqual({ id: 1, name: '営業本部' });
  });

  it('isActive 省略時は更新データに含めない', async () => {
    mockDeptFindUnique.mockResolvedValue({ id: BigInt(3) });
    mockDeptUpdate.mockResolvedValue(
      makeMockDepartment({
        parentDepartmentId: null,
        managerId: null,
        parentDepartment: null,
        manager: null,
      })
    );

    await updateDepartment(3, { name: '東日本営業部' });

    const calledData = mockDeptUpdate.mock.calls[0][0].data;
    expect('isActive' in calledData).toBe(false);
  });

  it('parentDepartmentId 省略時は更新データに含めない（データロス防止）', async () => {
    mockDeptFindUnique.mockResolvedValue({ id: BigInt(3) });
    mockDeptUpdate.mockResolvedValue(
      makeMockDepartment({
        parentDepartmentId: null,
        managerId: null,
        parentDepartment: null,
        manager: null,
      })
    );

    await updateDepartment(3, { name: '東日本営業部' });

    const calledData = mockDeptUpdate.mock.calls[0][0].data;
    expect('parentDepartmentId' in calledData).toBe(false);
  });

  it('managerId 省略時は更新データに含めない（データロス防止）', async () => {
    mockDeptFindUnique.mockResolvedValue({ id: BigInt(3) });
    mockDeptUpdate.mockResolvedValue(
      makeMockDepartment({
        parentDepartmentId: null,
        managerId: null,
        parentDepartment: null,
        manager: null,
      })
    );

    await updateDepartment(3, { name: '東日本営業部' });

    const calledData = mockDeptUpdate.mock.calls[0][0].data;
    expect('managerId' in calledData).toBe(false);
  });

  it('parentDepartmentId を null で明示的に渡した場合は null をセットする', async () => {
    mockDeptFindUnique.mockResolvedValue({ id: BigInt(3) });
    mockDeptUpdate.mockResolvedValue(
      makeMockDepartment({
        parentDepartmentId: null,
        parentDepartment: null,
        managerId: BigInt(8),
      })
    );

    await updateDepartment(3, { name: '東日本営業部', parentDepartmentId: null });

    const calledData = mockDeptUpdate.mock.calls[0][0].data;
    expect(calledData.parentDepartmentId).toBeNull();
  });

  it('managerId を null で明示的に渡した場合は null をセットする', async () => {
    mockDeptFindUnique.mockResolvedValue({ id: BigInt(3) });
    mockDeptUpdate.mockResolvedValue(
      makeMockDepartment({
        parentDepartmentId: BigInt(1),
        parentDepartment: { id: BigInt(1), name: '営業本部' },
        managerId: null,
        manager: null,
      })
    );

    await updateDepartment(3, { name: '東日本営業部', managerId: null });

    const calledData = mockDeptUpdate.mock.calls[0][0].data;
    expect(calledData.managerId).toBeNull();
  });
});

describe('deleteDepartment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('論理削除で isActive=false に更新する', async () => {
    mockDeptUpdate.mockResolvedValue(makeMockDepartment({ isActive: false }));

    await deleteDepartment(3);

    expect(mockDeptUpdate).toHaveBeenCalledWith({
      where: { id: BigInt(3) },
      data: { isActive: false },
    });
  });

  it('存在しない部署の削除 → 404', async () => {
    const { Prisma } = await import('@/generated/prisma/client');
    mockDeptUpdate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Not found', {
        code: 'P2025',
        clientVersion: 'test',
      })
    );

    await expect(deleteDepartment(999)).rejects.toMatchObject({ status: 404 });
  });
});
