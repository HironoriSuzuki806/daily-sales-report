import { forbidden, notFound } from '@/lib/api';
import { formatDatetime } from '@/lib/format';
import { prisma } from '@/lib/prisma';

export interface CommentResponse {
  id: number;
  commenter: { id: number; name: string };
  content: string;
  createdAt: string;
}

export async function listComments(
  dailyReportId: number,
  requesterId: number,
  role: 'SALES' | 'MANAGER' | 'ADMIN',
  departmentId: number | null
): Promise<CommentResponse[]> {
  const report = await prisma.dailyReport.findUnique({
    where: { id: BigInt(dailyReportId) },
    include: {
      salesperson: { select: { id: true, departmentId: true } },
    },
  });

  if (!report) notFound('日報が見つかりません');

  if (role === 'SALES') {
    if (Number(report.salesperson.id) !== requesterId) {
      forbidden('この日報のコメントを参照する権限がありません');
    }
  } else if (role === 'MANAGER') {
    if (
      report.salesperson.departmentId === null ||
      departmentId === null ||
      Number(report.salesperson.departmentId) !== departmentId
    ) {
      forbidden('この日報のコメントを参照する権限がありません');
    }
  }

  const comments = await prisma.comment.findMany({
    where: { dailyReportId: BigInt(dailyReportId) },
    include: { commenter: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return comments.map((c) => ({
    id: Number(c.id),
    commenter: { id: Number(c.commenter.id), name: c.commenter.name },
    content: c.content,
    createdAt: formatDatetime(c.createdAt),
  }));
}

export async function createComment(
  dailyReportId: number,
  commenterId: number,
  commenterDepartmentId: number | null,
  content: string
): Promise<CommentResponse> {
  const report = await prisma.dailyReport.findUnique({
    where: { id: BigInt(dailyReportId) },
    include: { salesperson: { select: { departmentId: true } } },
  });

  if (!report) notFound('日報が見つかりません');

  if (
    report.salesperson.departmentId === null ||
    commenterDepartmentId === null ||
    Number(report.salesperson.departmentId) !== commenterDepartmentId
  ) {
    forbidden('この日報にコメントする権限がありません');
  }

  const comment = await prisma.comment.create({
    data: {
      dailyReportId: BigInt(dailyReportId),
      commenterId: BigInt(commenterId),
      content,
    },
    include: { commenter: { select: { id: true, name: true } } },
  });

  return {
    id: Number(comment.id),
    commenter: { id: Number(comment.commenter.id), name: comment.commenter.name },
    content: comment.content,
    createdAt: formatDatetime(comment.createdAt),
  };
}
