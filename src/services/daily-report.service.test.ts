// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@/generated/prisma/client';

import { createDailyReport, listDailyReports } from './daily-report.service';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    dailyReport: {
      create: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    salesperson: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((promises: Promise<unknown>[]) => Promise.all(promises)),
  },
}));

import { prisma } from '@/lib/prisma';
const mockCreate = prisma.dailyReport.create as ReturnType<typeof vi.fn>;
const mockCount = prisma.dailyReport.count as ReturnType<typeof vi.fn>;
const mockFindMany = prisma.dailyReport.findMany as ReturnType<typeof vi.fn>;
const mockSalespersonFindUnique = prisma.salesperson.findUnique as ReturnType<typeof vi.fn>;

const now = new Date('2026-06-04T10:00:00Z');

function makeMockReport(overrides = {}) {
  return {
    id: BigInt(1001),
    salespersonId: BigInt(12),
    reportDate: new Date('2026-06-04'),
    problem: null,
    plan: null,
    status: 'DRAFT' as const,
    submittedAt: null,
    createdAt: now,
    updatedAt: now,
    salesperson: { id: BigInt(12), name: '山田太郎' },
    visitRecords: [],
    comments: [],
    ...overrides,
  };
}

describe('createDailyReport', () => {
  beforeEach(() => vi.clearAllMocks());

  it('TC-RPT-001: 正常作成 → 201 DRAFT', async () => {
    const mockReport = makeMockReport();
    mockCreate.mockResolvedValue(mockReport);

    const result = await createDailyReport(12, {
      reportDate: '2026-06-04',
      visitRecords: [],
    });

    expect(result.id).toBe(1001);
    expect(result.status).toBe('DRAFT');
    expect(result.salesperson).toEqual({ id: 12, name: '山田太郎' });
    expect(result.reportDate).toBe('2026-06-04');
    expect(result.submittedAt).toBeNull();
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          salespersonId: BigInt(12),
          reportDate: new Date('2026-06-04'),
          status: 'DRAFT',
        }),
      })
    );
  });

  it('TC-RPT-002: 訪問記録を複数行登録 → sortOrder順に並ぶ', async () => {
    const visitRecords = [
      {
        id: BigInt(5001),
        dailyReportId: BigInt(1001),
        customerId: BigInt(30),
        visitContent: '提案',
        visitTime: '10:00',
        sortOrder: 1,
        createdAt: now,
        updatedAt: now,
        customer: { id: BigInt(30), name: 'ABC商事' },
      },
      {
        id: BigInt(5002),
        dailyReportId: BigInt(1001),
        customerId: BigInt(31),
        visitContent: 'フォロー',
        visitTime: '14:00',
        sortOrder: 2,
        createdAt: now,
        updatedAt: now,
        customer: { id: BigInt(31), name: 'XYZ工業' },
      },
      {
        id: BigInt(5003),
        dailyReportId: BigInt(1001),
        customerId: BigInt(32),
        visitContent: '契約',
        visitTime: '16:00',
        sortOrder: 3,
        createdAt: now,
        updatedAt: now,
        customer: { id: BigInt(32), name: 'DEF商店' },
      },
    ];
    const mockReport = makeMockReport({ visitRecords });
    mockCreate.mockResolvedValue(mockReport);

    const result = await createDailyReport(12, {
      reportDate: '2026-06-04',
      visitRecords: [
        { customerId: 30, visitTime: '10:00', visitContent: '提案', sortOrder: 1 },
        { customerId: 31, visitTime: '14:00', visitContent: 'フォロー', sortOrder: 2 },
        { customerId: 32, visitTime: '16:00', visitContent: '契約', sortOrder: 3 },
      ],
    });

    expect(result.visitRecords).toHaveLength(3);
    expect(result.visitRecords[0].sortOrder).toBe(1);
    expect(result.visitRecords[1].sortOrder).toBe(2);
    expect(result.visitRecords[2].sortOrder).toBe(3);
    expect(result.visitRecords[0].customer?.name).toBe('ABC商事');
  });

  it('TC-RPT-003: 同一日重複 → conflict (409)', async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '7.0.0',
      meta: { target: ['salesperson_id', 'report_date'] },
    });
    mockCreate.mockRejectedValue(prismaError);

    const { ApiError } = await import('@/lib/api');
    await expect(
      createDailyReport(12, { reportDate: '2026-06-04', visitRecords: [] })
    ).rejects.toThrow(ApiError);
  });

  it('problem・plan が任意で保存できる', async () => {
    const mockReport = makeMockReport({
      problem: '課題テキスト',
      plan: '予定テキスト',
    });
    mockCreate.mockResolvedValue(mockReport);

    const result = await createDailyReport(12, {
      reportDate: '2026-06-04',
      problem: '課題テキスト',
      plan: '予定テキスト',
      visitRecords: [],
    });

    expect(result.problem).toBe('課題テキスト');
    expect(result.plan).toBe('予定テキスト');
  });

  it('TC-RPT-010: problem・plan 未入力でも下書き保存できる', async () => {
    const mockReport = makeMockReport();
    mockCreate.mockResolvedValue(mockReport);

    const result = await createDailyReport(12, {
      reportDate: '2026-06-04',
      visitRecords: [],
    });

    expect(result.problem).toBeNull();
    expect(result.plan).toBeNull();
  });
});

const salesUser = {
  id: 12,
  name: '山田太郎',
  email: 'yamada@example.com',
  role: 'SALES' as const,
  departmentId: 3,
};

const managerUser = {
  id: 8,
  name: '佐藤部長',
  email: 'sato@example.com',
  role: 'MANAGER' as const,
  departmentId: 3,
};

const defaultPagination = { page: 0, size: 20, sort: undefined };

function makeMockListItem(overrides = {}) {
  return {
    id: BigInt(1001),
    salespersonId: BigInt(12),
    reportDate: new Date('2026-06-04'),
    problem: null,
    plan: null,
    status: 'SUBMITTED' as const,
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
    salesperson: { id: BigInt(12), name: '山田太郎' },
    _count: { visitRecords: 3, comments: 1 },
    ...overrides,
  };
}

describe('listDailyReports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCount.mockResolvedValue(0);
    mockFindMany.mockResolvedValue([]);
  });

  it('TC-LST-001: SALES は自分の日報のみ（salespersonId パラメータは無視）', async () => {
    await listDailyReports(salesUser, { salespersonId: 99 }, defaultPagination);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { salespersonId: BigInt(12) },
      })
    );
    expect(mockSalespersonFindUnique).not.toHaveBeenCalled();
  });

  it('TC-LST-002: MANAGER が部署メンバーの salespersonId を指定 → そのメンバーで絞り込み', async () => {
    mockSalespersonFindUnique.mockResolvedValue({ departmentId: BigInt(3) });

    await listDailyReports(managerUser, { salespersonId: 12 }, defaultPagination);

    expect(mockSalespersonFindUnique).toHaveBeenCalledWith({
      where: { id: BigInt(12) },
      select: { departmentId: true },
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { salespersonId: BigInt(12) },
      })
    );
  });

  it('MANAGER が他部署の salespersonId を指定 → 403', async () => {
    mockSalespersonFindUnique.mockResolvedValue({ departmentId: BigInt(99) });

    const { ApiError } = await import('@/lib/api');
    await expect(
      listDailyReports(managerUser, { salespersonId: 50 }, defaultPagination)
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      listDailyReports(managerUser, { salespersonId: 50 }, defaultPagination)
    ).rejects.toThrow(ApiError);
  });

  it('MANAGER が存在しない salespersonId を指定 → 403', async () => {
    mockSalespersonFindUnique.mockResolvedValue(null);

    await expect(
      listDailyReports(managerUser, { salespersonId: 9999 }, defaultPagination)
    ).rejects.toMatchObject({ status: 403 });
  });

  it('MANAGER が自分の id を指定 → メンバー確認なしで自分の日報', async () => {
    await listDailyReports(managerUser, { salespersonId: 8 }, defaultPagination);

    expect(mockSalespersonFindUnique).not.toHaveBeenCalled();
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { salespersonId: BigInt(8) },
      })
    );
  });

  it('MANAGER が salespersonId 未指定 → 本人＋所属部署メンバーの日報', async () => {
    await listDailyReports(managerUser, {}, defaultPagination);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ salespersonId: BigInt(8) }, { salesperson: { departmentId: BigInt(3) } }],
        },
      })
    );
  });

  it('所属部署のない MANAGER は salespersonId 未指定時に自分の日報のみ', async () => {
    await listDailyReports({ ...managerUser, departmentId: null }, {}, defaultPagination);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { salespersonId: BigInt(8) },
      })
    );
  });

  it('TC-LST-003: dateFrom/dateTo で reportDate を範囲絞り込み', async () => {
    await listDailyReports(
      salesUser,
      { dateFrom: '2026-06-01', dateTo: '2026-06-30' },
      defaultPagination
    );

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          reportDate: {
            gte: new Date('2026-06-01'),
            lte: new Date('2026-06-30'),
          },
        }),
      })
    );
  });

  it('TC-LST-004: status=SUBMITTED で絞り込み', async () => {
    await listDailyReports(salesUser, { status: 'SUBMITTED' }, defaultPagination);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'SUBMITTED' }),
      })
    );
  });

  it('TC-LST-005: ページング（skip/take と totalPages の計算）', async () => {
    mockCount.mockResolvedValue(53);
    mockFindMany.mockResolvedValue([makeMockListItem()]);

    const result = await listDailyReports(salesUser, {}, { page: 1, size: 20, sort: undefined });

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 20 }));
    expect(result.page).toBe(1);
    expect(result.size).toBe(20);
    expect(result.totalElements).toBe(53);
    expect(result.totalPages).toBe(3);
  });

  it('一覧項目に visitCount・commentCount が含まれる', async () => {
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([makeMockListItem()]);

    const result = await listDailyReports(salesUser, {}, defaultPagination);

    expect(result.content[0]).toEqual({
      id: 1001,
      reportDate: '2026-06-04',
      salesperson: { id: 12, name: '山田太郎' },
      visitCount: 3,
      status: 'SUBMITTED',
      commentCount: 1,
    });
  });

  it('デフォルトソートは reportDate DESC', async () => {
    await listDailyReports(salesUser, {}, defaultPagination);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ reportDate: 'desc' }, { id: 'desc' }],
      })
    );
  });
});
