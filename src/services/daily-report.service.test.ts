// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@/generated/prisma/client';

import { createDailyReport } from './daily-report.service';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    dailyReport: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
const mockCreate = prisma.dailyReport.create as ReturnType<typeof vi.fn>;

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
