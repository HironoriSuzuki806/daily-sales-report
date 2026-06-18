// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { listComments, createComment } from './comment.service';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    comment: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    dailyReport: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
const mockCommentFindMany = prisma.comment.findMany as ReturnType<typeof vi.fn>;
const mockCommentCreate = prisma.comment.create as ReturnType<typeof vi.fn>;
const mockReportFindUnique = prisma.dailyReport.findUnique as ReturnType<typeof vi.fn>;

const now = new Date('2026-06-04T19:00:00Z');

function makeMockComment(overrides = {}) {
  return {
    id: BigInt(9001),
    dailyReportId: BigInt(1001),
    commenterId: BigInt(8),
    content: 'コメント内容',
    createdAt: now,
    updatedAt: now,
    commenter: { id: BigInt(8), name: '佐藤部長' },
    ...overrides,
  };
}

function makeMockReport(salespersonId = BigInt(12), departmentId = BigInt(3)) {
  return {
    id: BigInt(1001),
    salespersonId,
    reportDate: new Date('2026-06-04'),
    problem: null,
    plan: null,
    status: 'SUBMITTED' as const,
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
    salesperson: {
      id: salespersonId,
      name: '山田太郎',
      departmentId,
    },
  };
}

describe('listComments', () => {
  beforeEach(() => vi.clearAllMocks());

  it('TC-CMT-002: 複数コメントが createdAt 昇順で返る', async () => {
    const earlier = makeMockComment({
      id: BigInt(9001),
      content: '最初のコメント',
      createdAt: new Date('2026-06-04T19:00:00Z'),
    });
    const later = makeMockComment({
      id: BigInt(9002),
      content: '後のコメント',
      createdAt: new Date('2026-06-04T20:00:00Z'),
    });
    mockReportFindUnique.mockResolvedValue(makeMockReport());
    mockCommentFindMany.mockResolvedValue([earlier, later]);

    const result = await listComments(1001, 12, 'SALES', 3);

    expect(result).toHaveLength(2);
    expect(result[0].content).toBe('最初のコメント');
    expect(result[1].content).toBe('後のコメント');
    expect(mockCommentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'asc' },
      })
    );
  });

  it('TC-CMT-006: SALESが自分の日報のコメントを取得できる', async () => {
    mockReportFindUnique.mockResolvedValue(makeMockReport(BigInt(12), BigInt(3)));
    mockCommentFindMany.mockResolvedValue([makeMockComment()]);

    const result = await listComments(1001, 12, 'SALES', 3);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(9001);
    expect(result[0].commenter.name).toBe('佐藤部長');
  });

  it('SALESが他人の日報のコメントを取得 → 403', async () => {
    mockReportFindUnique.mockResolvedValue(makeMockReport(BigInt(15), BigInt(5)));

    const { ApiError } = await import('@/lib/api');
    await expect(listComments(1001, 12, 'SALES', 3)).rejects.toThrow(ApiError);
  });

  it('MANAGERが部署メンバーの日報コメントを取得できる', async () => {
    mockReportFindUnique.mockResolvedValue(makeMockReport(BigInt(12), BigInt(3)));
    mockCommentFindMany.mockResolvedValue([makeMockComment()]);

    const result = await listComments(1001, 8, 'MANAGER', 3);

    expect(result).toHaveLength(1);
  });

  it('存在しない日報のコメント取得 → 404', async () => {
    mockReportFindUnique.mockResolvedValue(null);

    await expect(listComments(9999, 12, 'SALES', 3)).rejects.toMatchObject({ status: 404 });
  });
});

describe('createComment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('TC-CMT-001: MANAGERがコメントを投稿できる → コメントが作成される', async () => {
    mockReportFindUnique.mockResolvedValue(makeMockReport(BigInt(12), BigInt(3)));
    mockCommentCreate.mockResolvedValue(makeMockComment());

    const result = await createComment(1001, 8, 3, 'コメント内容');

    expect(result.id).toBe(9001);
    expect(result.commenter.id).toBe(8);
    expect(result.content).toBe('コメント内容');
    expect(mockCommentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dailyReportId: BigInt(1001),
          commenterId: BigInt(8),
          content: 'コメント内容',
        }),
      })
    );
  });

  it('他部署MANAGERがコメントを投稿 → 403', async () => {
    mockReportFindUnique.mockResolvedValue(makeMockReport(BigInt(12), BigInt(3)));

    const { ApiError } = await import('@/lib/api');
    await expect(createComment(1001, 99, 5, 'コメント')).rejects.toThrow(ApiError);
    expect(mockCommentCreate).not.toHaveBeenCalled();
  });

  it('commenterDepartmentId が null のMANAGERがコメントを投稿 → 403', async () => {
    mockReportFindUnique.mockResolvedValue(makeMockReport(BigInt(12), BigInt(3)));

    await expect(createComment(1001, 99, null, 'コメント')).rejects.toMatchObject({ status: 403 });
    expect(mockCommentCreate).not.toHaveBeenCalled();
  });

  it('存在しない日報へのコメント → 404', async () => {
    mockReportFindUnique.mockResolvedValue(null);

    await expect(createComment(9999, 8, 3, 'コメント')).rejects.toMatchObject({ status: 404 });
    expect(mockCommentCreate).not.toHaveBeenCalled();
  });
});
