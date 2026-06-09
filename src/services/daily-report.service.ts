import { Prisma } from '@/generated/prisma/client';
import { conflict } from '@/lib/api';
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

// ─── Service function ──────────────────────────────────────────────────────────

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
          create: (input.visitRecords ?? []).map((vr) => ({
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
