import { Prisma } from '@/generated/prisma/client';
import { conflict, forbidden } from '@/lib/api';
import type { AuthUser } from '@/lib/api';
import { createPageResponse, PaginationQuery, PageResponse } from '@/lib/api/pagination';
import { formatDate, formatDatetime } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import type { CreateDailyReportInput, DailyReportQuery } from '@/lib/schemas/daily-report.schema';

// ─── Response types ────────────────────────────────────────────────────────────

export interface DailyReportListItemResponse {
  id: number;
  reportDate: string;
  salesperson: { id: number; name: string };
  visitCount: number;
  status: 'DRAFT' | 'SUBMITTED';
  commentCount: number;
}

export interface VisitRecordResponse {
  id: number;
  customer: { id: number; name: string } | null;
  visitTime: string | null;
  visitContent: string | null;
  sortOrder: number;
}

export interface CommentResponse {
  id: number;
  commenter: { id: number; name: string };
  content: string;
  createdAt: string;
}

export interface DailyReportDetailResponse {
  id: number;
  reportDate: string;
  salesperson: { id: number; name: string };
  status: 'DRAFT' | 'SUBMITTED';
  submittedAt: string | null;
  problem: string | null;
  plan: string | null;
  visitRecords: VisitRecordResponse[];
  comments: CommentResponse[];
  createdAt: string;
  updatedAt: string;
}

// ─── Prisma include shape ──────────────────────────────────────────────────────

const dailyReportInclude = {
  salesperson: { select: { id: true, name: true } },
  visitRecords: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      customer: { select: { id: true, name: true } },
    },
  },
  comments: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      commenter: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.DailyReportInclude;

// ─── Mapper ───────────────────────────────────────────────────────────────────

type DailyReportWithRelations = Prisma.DailyReportGetPayload<{
  include: typeof dailyReportInclude;
}>;

export function mapToDetailResponse(report: DailyReportWithRelations): DailyReportDetailResponse {
  return {
    id: Number(report.id),
    reportDate: formatDate(report.reportDate),
    salesperson: {
      id: Number(report.salesperson.id),
      name: report.salesperson.name,
    },
    status: report.status,
    submittedAt: report.submittedAt ? formatDatetime(report.submittedAt) : null,
    problem: report.problem ?? null,
    plan: report.plan ?? null,
    visitRecords: report.visitRecords.map((vr) => ({
      id: Number(vr.id),
      customer: vr.customer ? { id: Number(vr.customer.id), name: vr.customer.name } : null,
      visitTime: vr.visitTime ?? null,
      visitContent: vr.visitContent ?? null,
      sortOrder: vr.sortOrder,
    })),
    comments: report.comments.map((c) => ({
      id: Number(c.id),
      commenter: { id: Number(c.commenter.id), name: c.commenter.name },
      content: c.content,
      createdAt: formatDatetime(c.createdAt),
    })),
    createdAt: formatDatetime(report.createdAt),
    updatedAt: formatDatetime(report.updatedAt),
  };
}

const dailyReportListInclude = {
  salesperson: { select: { id: true, name: true } },
  _count: { select: { visitRecords: true, comments: true } },
} satisfies Prisma.DailyReportInclude;

type DailyReportListItem = Prisma.DailyReportGetPayload<{
  include: typeof dailyReportListInclude;
}>;

function mapToListItemResponse(report: DailyReportListItem): DailyReportListItemResponse {
  return {
    id: Number(report.id),
    reportDate: formatDate(report.reportDate),
    salesperson: {
      id: Number(report.salesperson.id),
      name: report.salesperson.name,
    },
    visitCount: report._count.visitRecords,
    status: report.status,
    commentCount: report._count.comments,
  };
}

// ─── Service functions ─────────────────────────────────────────────────────────

/**
 * 権限に応じた日報の絞り込み条件を組み立てる。
 * - SALES: 自分の日報のみ（salespersonId パラメータは無視）
 * - MANAGER: salespersonId 指定時は所属部署メンバー（または本人）か確認。
 *   未指定時は本人＋所属部署メンバーの日報
 */
async function buildScopeWhere(
  user: AuthUser,
  query: DailyReportQuery
): Promise<Prisma.DailyReportWhereInput> {
  if (user.role !== 'MANAGER') {
    return { salespersonId: BigInt(user.id) };
  }

  if (query.salespersonId !== undefined) {
    if (query.salespersonId === user.id) {
      return { salespersonId: BigInt(user.id) };
    }

    const target = await prisma.salesperson.findUnique({
      where: { id: BigInt(query.salespersonId) },
      select: { departmentId: true },
    });
    const isDepartmentMember =
      target !== null &&
      target.departmentId !== null &&
      user.departmentId !== null &&
      Number(target.departmentId) === user.departmentId;

    if (!isDepartmentMember) {
      forbidden('指定された営業の日報を参照する権限がありません');
    }
    return { salespersonId: BigInt(query.salespersonId) };
  }

  if (user.departmentId === null) {
    return { salespersonId: BigInt(user.id) };
  }
  return {
    OR: [
      { salespersonId: BigInt(user.id) },
      { salesperson: { departmentId: BigInt(user.departmentId) } },
    ],
  };
}

export async function listDailyReports(
  user: AuthUser,
  query: DailyReportQuery,
  pagination: PaginationQuery
): Promise<PageResponse<DailyReportListItemResponse>> {
  const where = await buildScopeWhere(user, query);

  if (query.dateFrom !== undefined || query.dateTo !== undefined) {
    const dateFilter: Prisma.DateTimeFilter<'DailyReport'> = {};
    if (query.dateFrom !== undefined) {
      dateFilter.gte = new Date(query.dateFrom);
    }
    if (query.dateTo !== undefined) {
      dateFilter.lte = new Date(query.dateTo);
    }
    where.reportDate = dateFilter;
  }
  if (query.status !== undefined) {
    where.status = query.status;
  }

  const [total, reports] = await prisma.$transaction([
    prisma.dailyReport.count({ where }),
    prisma.dailyReport.findMany({
      where,
      include: dailyReportListInclude,
      skip: pagination.page * pagination.size,
      take: pagination.size,
      orderBy: [{ reportDate: 'desc' }, { id: 'desc' }],
    }),
  ]);

  return createPageResponse(reports.map(mapToListItemResponse), total, pagination);
}

export async function createDailyReport(
  salespersonId: number,
  input: CreateDailyReportInput
): Promise<DailyReportDetailResponse> {
  const reportDate = new Date(input.reportDate);

  try {
    const report = await prisma.dailyReport.create({
      data: {
        salespersonId: BigInt(salespersonId),
        reportDate,
        problem: input.problem ?? null,
        plan: input.plan ?? null,
        status: 'DRAFT',
        visitRecords: {
          create: input.visitRecords.map((vr) => ({
            customerId: vr.customerId ? BigInt(vr.customerId) : null,
            visitTime: vr.visitTime ?? null,
            visitContent: vr.visitContent ?? null,
            sortOrder: vr.sortOrder,
          })),
        },
      },
      include: dailyReportInclude,
    });

    return mapToDetailResponse(report);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      conflict('同一日の日報が既に存在します');
    }
    throw err;
  }
}
