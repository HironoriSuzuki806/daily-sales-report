import { Prisma } from '@/generated/prisma/client';
import { badRequest, conflict, createPageResponse, forbidden, notFound } from '@/lib/api';
import type { PageResponse } from '@/lib/api/pagination';
import { formatDate, formatDatetime } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import type { CreateDailyReportInput } from '@/lib/schemas/daily-report.schema';

// ─── Response types ────────────────────────────────────────────────────────────

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
  salesperson: { select: { id: true, name: true, departmentId: true } },
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

// ─── Summary type for list responses ──────────────────────────────────────────

export interface DailyReportSummaryResponse {
  id: number;
  reportDate: string;
  salesperson: { id: number; name: string };
  visitCount: number;
  status: 'DRAFT' | 'SUBMITTED';
  commentCount: number;
}

// ─── Filter types ──────────────────────────────────────────────────────────────

export interface ListDailyReportsFilters {
  dateFrom?: string;
  dateTo?: string;
  salespersonId?: number;
  status?: 'DRAFT' | 'SUBMITTED';
}

// ─── Service functions ─────────────────────────────────────────────────────────

export async function listDailyReports(
  requesterId: number,
  role: 'SALES' | 'MANAGER' | 'ADMIN',
  departmentId: number | null,
  filters: ListDailyReportsFilters,
  pagination: { page: number; size: number; sort?: string }
): Promise<PageResponse<DailyReportSummaryResponse>> {
  const where: Prisma.DailyReportWhereInput = {};

  if (role === 'SALES') {
    where.salespersonId = BigInt(requesterId);
  } else if (role === 'MANAGER') {
    if (departmentId === null) {
      return createPageResponse([], 0, pagination);
    }
    where.salesperson = { departmentId: BigInt(departmentId) };
    if (filters.salespersonId) {
      where.salespersonId = BigInt(filters.salespersonId);
    }
  }

  if (filters.dateFrom || filters.dateTo) {
    where.reportDate = {
      ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
      ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
    };
  }

  if (filters.status) {
    where.status = filters.status;
  }

  const [total, reports] = await Promise.all([
    prisma.dailyReport.count({ where }),
    prisma.dailyReport.findMany({
      where,
      include: {
        salesperson: { select: { id: true, name: true } },
        visitRecords: { select: { id: true } },
        comments: { select: { id: true } },
      },
      skip: pagination.page * pagination.size,
      take: pagination.size,
      orderBy: { reportDate: 'desc' },
    }),
  ]);

  const content: DailyReportSummaryResponse[] = reports.map((report) => ({
    id: Number(report.id),
    reportDate: formatDate(report.reportDate),
    salesperson: { id: Number(report.salesperson.id), name: report.salesperson.name },
    visitCount: report.visitRecords.length,
    commentCount: report.comments.length,
    status: report.status,
  }));

  return createPageResponse(content, total, pagination);
}

export async function getDailyReport(
  id: number,
  requesterId: number,
  role: 'SALES' | 'MANAGER' | 'ADMIN',
  departmentId: number | null
): Promise<DailyReportDetailResponse> {
  const report = await prisma.dailyReport.findUnique({
    where: { id: BigInt(id) },
    include: dailyReportInclude,
  });

  if (!report) notFound('日報が見つかりません');

  if (role === 'SALES') {
    if (Number(report.salespersonId) !== requesterId) {
      forbidden('この日報を参照する権限がありません');
    }
  } else if (role === 'MANAGER') {
    if (
      report.salesperson.departmentId === null ||
      departmentId === null ||
      Number(report.salesperson.departmentId) !== departmentId
    ) {
      forbidden('この日報を参照する権限がありません');
    }
  }

  return mapToDetailResponse(report);
}

export async function updateDailyReport(
  id: number,
  requesterId: number,
  input: CreateDailyReportInput
): Promise<DailyReportDetailResponse> {
  const existing = await prisma.dailyReport.findUnique({
    where: { id: BigInt(id) },
    select: { salespersonId: true, status: true },
  });

  if (!existing) notFound('日報が見つかりません');
  if (Number(existing.salespersonId) !== requesterId) {
    forbidden('この日報を更新する権限がありません');
  }
  if (existing.status === 'SUBMITTED') {
    badRequest('提出済みの日報は更新できません');
  }

  try {
    const updated = await prisma.dailyReport.update({
      where: { id: BigInt(id) },
      data: {
        reportDate: new Date(input.reportDate),
        problem: input.problem ?? null,
        plan: input.plan ?? null,
        visitRecords: {
          deleteMany: {},
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

    return mapToDetailResponse(updated);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      conflict('同一日の日報が既に存在します');
    }
    throw err;
  }
}

export async function deleteDailyReport(id: number, requesterId: number): Promise<void> {
  const report = await prisma.dailyReport.findUnique({
    where: { id: BigInt(id) },
    select: { salespersonId: true, status: true },
  });

  if (!report) notFound('日報が見つかりません');
  if (Number(report.salespersonId) !== requesterId) {
    forbidden('この日報を削除する権限がありません');
  }
  if (report.status === 'SUBMITTED') {
    badRequest('提出済みの日報は削除できません');
  }

  await prisma.dailyReport.delete({ where: { id: BigInt(id) } });
}

export async function submitDailyReport(
  id: number,
  requesterId: number
): Promise<DailyReportDetailResponse> {
  const report = await prisma.dailyReport.findUnique({
    where: { id: BigInt(id) },
    include: dailyReportInclude,
  });

  if (!report) notFound('日報が見つかりません');
  if (Number(report.salespersonId) !== requesterId) {
    forbidden('この日報を提出する権限がありません');
  }
  if (report.status === 'SUBMITTED') {
    badRequest('この日報は既に提出済みです');
  }

  if (report.visitRecords.length === 0) {
    badRequest('提出には訪問記録が1件以上必要です');
  }

  for (const vr of report.visitRecords) {
    if (!vr.customer) {
      badRequest('訪問記録に顧客が設定されていない行があります');
    }
    if (!vr.visitContent) {
      badRequest('訪問記録に訪問内容が入力されていない行があります');
    }
  }

  const updated = await prisma.dailyReport.update({
    where: { id: BigInt(id) },
    data: { status: 'SUBMITTED', submittedAt: new Date() },
    include: dailyReportInclude,
  });

  return mapToDetailResponse(updated);
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
