// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@/generated/prisma/client';

import {
  createDailyReport,
  getDailyReport,
  listDailyReports,
  updateDailyReport,
  deleteDailyReport,
  submitDailyReport,
} from './daily-report.service';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    dailyReport: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
const mockCreate = prisma.dailyReport.create as ReturnType<typeof vi.fn>;
const mockFindUnique = prisma.dailyReport.findUnique as ReturnType<typeof vi.fn>;
const mockFindMany = prisma.dailyReport.findMany as ReturnType<typeof vi.fn>;
const mockCount = prisma.dailyReport.count as ReturnType<typeof vi.fn>;
const mockUpdate = prisma.dailyReport.update as ReturnType<typeof vi.fn>;
const mockDelete = prisma.dailyReport.delete as ReturnType<typeof vi.fn>;
const mockTransaction = prisma.$transaction as ReturnType<typeof vi.fn>;

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
    salesperson: { id: BigInt(12), name: '山田太郎', departmentId: BigInt(3) },
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

describe('listDailyReports', () => {
  beforeEach(() => vi.clearAllMocks());

  it('TC-LST-001: SALESロールは自分の日報のみ返す', async () => {
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([makeMockReport()]);

    const result = await listDailyReports(12, 'SALES', 3, {}, { page: 0, size: 20 });

    expect(result.totalElements).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.content[0].id).toBe(1001);
    expect(result.content[0].visitCount).toBeDefined();
    expect(result.content[0].commentCount).toBeDefined();
  });

  it('TC-LST-002: MANAGERが salespersonId フィルタで部署メンバーの日報を取得できる', async () => {
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([makeMockReport()]);

    const result = await listDailyReports(
      8,
      'MANAGER',
      3,
      { salespersonId: 12 },
      { page: 0, size: 20 }
    );

    expect(result.content[0].id).toBe(1001);
    expect(mockCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          salespersonId: BigInt(12),
        }),
      })
    );
  });

  it('MANAGERの departmentId が null の場合は空リストを返す', async () => {
    const result = await listDailyReports(8, 'MANAGER', null, {}, { page: 0, size: 20 });

    expect(result.content).toHaveLength(0);
    expect(result.totalElements).toBe(0);
    expect(mockCount).not.toHaveBeenCalled();
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('TC-LST-003: dateFrom/dateTo で期間絞り込みができる', async () => {
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([makeMockReport()]);

    const result = await listDailyReports(
      12,
      'SALES',
      3,
      { dateFrom: '2026-06-01', dateTo: '2026-06-30' },
      { page: 0, size: 20 }
    );

    expect(result.content).toHaveLength(1);
  });

  it('TC-LST-004: status=SUBMITTED で絞り込みができる', async () => {
    const submittedReport = makeMockReport({ status: 'SUBMITTED' as const });
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([submittedReport]);

    const result = await listDailyReports(
      12,
      'SALES',
      3,
      { status: 'SUBMITTED' },
      { page: 0, size: 20 }
    );

    expect(result.content[0].status).toBe('SUBMITTED');
  });

  it('TC-LST-005: 21件以上でページング結果が正しい（2ページ目）', async () => {
    const reports = Array.from({ length: 1 }, () => makeMockReport());
    mockCount.mockResolvedValue(21);
    mockFindMany.mockResolvedValue(reports);

    const result = await listDailyReports(12, 'SALES', 3, {}, { page: 1, size: 20 });

    expect(result.totalElements).toBe(21);
    expect(result.totalPages).toBe(2);
    expect(result.page).toBe(1);
  });
});

describe('getDailyReport', () => {
  beforeEach(() => vi.clearAllMocks());

  it('TC-LST-006: 詳細に visitRecords・comments が含まれる', async () => {
    const reportWithRelations = makeMockReport({
      visitRecords: [
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
      ],
      comments: [
        {
          id: BigInt(9001),
          dailyReportId: BigInt(1001),
          commenterId: BigInt(8),
          content: 'コメント内容',
          createdAt: now,
          updatedAt: now,
          commenter: { id: BigInt(8), name: '佐藤部長' },
        },
      ],
    });
    mockFindUnique.mockResolvedValue(reportWithRelations);

    const result = await getDailyReport(1001, 12, 'SALES', 3);

    expect(result.visitRecords).toHaveLength(1);
    expect(result.visitRecords[0].customer?.name).toBe('ABC商事');
    expect(result.comments).toHaveLength(1);
    expect(result.comments[0].commenter.name).toBe('佐藤部長');
  });

  it('TC-LST-007: 参照権限外の日報 → 403', async () => {
    const otherPersonReport = makeMockReport({ salespersonId: BigInt(15) });
    mockFindUnique.mockResolvedValue(otherPersonReport);

    const { ApiError } = await import('@/lib/api');
    await expect(getDailyReport(1001, 12, 'SALES', 3)).rejects.toThrow(ApiError);
  });

  it('存在しない日報 → 404', async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(getDailyReport(9999, 12, 'SALES', 3)).rejects.toMatchObject({ status: 404 });
  });
});

describe('updateDailyReport', () => {
  beforeEach(() => vi.clearAllMocks());

  it('TC-RPT-007: visitRecords 全置換（3件 → 1件に削減）', async () => {
    const existingReport = makeMockReport({ salespersonId: BigInt(12) });
    mockFindUnique.mockResolvedValue(existingReport);
    mockUpdate.mockResolvedValue(
      makeMockReport({
        visitRecords: [
          {
            id: BigInt(5001),
            dailyReportId: BigInt(1001),
            customerId: BigInt(30),
            visitContent: '残したい訪問',
            visitTime: null,
            sortOrder: 1,
            createdAt: now,
            updatedAt: now,
            customer: { id: BigInt(30), name: 'ABC商事' },
          },
        ],
      })
    );

    const result = await updateDailyReport(1001, 12, {
      reportDate: '2026-06-04',
      visitRecords: [{ customerId: 30, visitContent: '残したい訪問', sortOrder: 1 }],
    });

    expect(result.visitRecords).toHaveLength(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BigInt(1001) },
        data: expect.objectContaining({
          visitRecords: expect.objectContaining({
            deleteMany: {},
          }),
        }),
      })
    );
  });

  it('TC-RPT-008: id無し明細の新規追加 → 更新成功', async () => {
    const existingReport = makeMockReport({ salespersonId: BigInt(12) });
    mockFindUnique.mockResolvedValue(existingReport);
    mockUpdate.mockResolvedValue(makeMockReport());

    const result = await updateDailyReport(1001, 12, {
      reportDate: '2026-06-04',
      visitRecords: [{ customerId: 30, visitContent: '新規追加', sortOrder: 1 }],
    });

    expect(result.id).toBe(1001);
  });

  it('提出済み日報の更新 → 400', async () => {
    const submittedReport = makeMockReport({
      salespersonId: BigInt(12),
      status: 'SUBMITTED' as const,
    });
    mockFindUnique.mockResolvedValue(submittedReport);

    await expect(
      updateDailyReport(1001, 12, { reportDate: '2026-06-04', visitRecords: [] })
    ).rejects.toMatchObject({ status: 400 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('TC-RPT-009: 他人の日報更新 → 403', async () => {
    const otherPersonReport = makeMockReport({ salespersonId: BigInt(15) });
    mockFindUnique.mockResolvedValue(otherPersonReport);

    const { ApiError } = await import('@/lib/api');
    await expect(
      updateDailyReport(1001, 12, { reportDate: '2026-06-04', visitRecords: [] })
    ).rejects.toThrow(ApiError);
  });

  it('存在しない日報の更新 → 404', async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(
      updateDailyReport(9999, 12, { reportDate: '2026-06-04', visitRecords: [] })
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('deleteDailyReport', () => {
  beforeEach(() => vi.clearAllMocks());

  it('TC-SUB-006: 下書きの削除 → 成功', async () => {
    const draftReport = makeMockReport({ status: 'DRAFT' as const, salespersonId: BigInt(12) });
    mockFindUnique.mockResolvedValue(draftReport);
    mockDelete.mockResolvedValue(draftReport);

    await expect(deleteDailyReport(1001, 12)).resolves.toBeUndefined();
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: BigInt(1001) } });
  });

  it('TC-SUB-005: 提出済み日報の削除 → 400', async () => {
    const submittedReport = makeMockReport({
      status: 'SUBMITTED' as const,
      salespersonId: BigInt(12),
    });
    mockFindUnique.mockResolvedValue(submittedReport);

    await expect(deleteDailyReport(1001, 12)).rejects.toMatchObject({ status: 400 });
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('他人の日報を削除 → 403', async () => {
    const otherReport = makeMockReport({ status: 'DRAFT' as const, salespersonId: BigInt(15) });
    mockFindUnique.mockResolvedValue(otherReport);

    await expect(deleteDailyReport(1001, 12)).rejects.toMatchObject({ status: 403 });
  });

  it('存在しない日報の削除 → 404', async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(deleteDailyReport(9999, 12)).rejects.toMatchObject({ status: 404 });
  });
});

describe('submitDailyReport', () => {
  beforeEach(() => vi.clearAllMocks());

  it('TC-SUB-001: 正常提出 → status=SUBMITTED + submittedAt 記録', async () => {
    const draftReport = makeMockReport({
      status: 'DRAFT' as const,
      salespersonId: BigInt(12),
      visitRecords: [
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
      ],
    });
    mockFindUnique.mockResolvedValue(draftReport);
    mockUpdate.mockResolvedValue(
      makeMockReport({
        status: 'SUBMITTED' as const,
        salespersonId: BigInt(12),
        submittedAt: now,
        visitRecords: draftReport.visitRecords,
      })
    );

    const result = await submitDailyReport(1001, 12);

    expect(result.status).toBe('SUBMITTED');
    expect(result.submittedAt).not.toBeNull();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SUBMITTED' }),
      })
    );
  });

  it('既に提出済みの日報を再提出 → 400', async () => {
    const submittedReport = makeMockReport({
      status: 'SUBMITTED' as const,
      salespersonId: BigInt(12),
      visitRecords: [
        {
          id: BigInt(5001),
          dailyReportId: BigInt(1001),
          customerId: BigInt(30),
          visitContent: '提案',
          visitTime: null,
          sortOrder: 1,
          createdAt: now,
          updatedAt: now,
          customer: { id: BigInt(30), name: 'ABC商事' },
        },
      ],
    });
    mockFindUnique.mockResolvedValue(submittedReport);

    await expect(submitDailyReport(1001, 12)).rejects.toMatchObject({ status: 400 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('TC-SUB-002: 訪問記録0件で提出 → 400', async () => {
    const emptyReport = makeMockReport({
      status: 'DRAFT' as const,
      salespersonId: BigInt(12),
      visitRecords: [],
    });
    mockFindUnique.mockResolvedValue(emptyReport);

    await expect(submitDailyReport(1001, 12)).rejects.toMatchObject({ status: 400 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('TC-SUB-003: 顧客未選択の訪問記録 → 400', async () => {
    const reportWithNoCustomer = makeMockReport({
      status: 'DRAFT' as const,
      salespersonId: BigInt(12),
      visitRecords: [
        {
          id: BigInt(5001),
          dailyReportId: BigInt(1001),
          customerId: null,
          visitContent: '訪問内容あり',
          visitTime: null,
          sortOrder: 1,
          createdAt: now,
          updatedAt: now,
          customer: null,
        },
      ],
    });
    mockFindUnique.mockResolvedValue(reportWithNoCustomer);

    await expect(submitDailyReport(1001, 12)).rejects.toMatchObject({ status: 400 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('TC-SUB-004: 訪問内容未入力の訪問記録 → 400', async () => {
    const reportWithNoContent = makeMockReport({
      status: 'DRAFT' as const,
      salespersonId: BigInt(12),
      visitRecords: [
        {
          id: BigInt(5001),
          dailyReportId: BigInt(1001),
          customerId: BigInt(30),
          visitContent: null,
          visitTime: null,
          sortOrder: 1,
          createdAt: now,
          updatedAt: now,
          customer: { id: BigInt(30), name: 'ABC商事' },
        },
      ],
    });
    mockFindUnique.mockResolvedValue(reportWithNoContent);

    await expect(submitDailyReport(1001, 12)).rejects.toMatchObject({ status: 400 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('他人の日報を提出 → 403', async () => {
    const otherReport = makeMockReport({
      status: 'DRAFT' as const,
      salespersonId: BigInt(15),
      visitRecords: [
        {
          id: BigInt(5001),
          dailyReportId: BigInt(1001),
          customerId: BigInt(30),
          visitContent: '提案',
          visitTime: null,
          sortOrder: 1,
          createdAt: now,
          updatedAt: now,
          customer: { id: BigInt(30), name: 'ABC商事' },
        },
      ],
    });
    mockFindUnique.mockResolvedValue(otherReport);

    await expect(submitDailyReport(1001, 12)).rejects.toMatchObject({ status: 403 });
  });
});
