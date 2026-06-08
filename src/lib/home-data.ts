import 'server-only';

/**
 * Data-access helpers for the Home page (SCR-002).
 *
 * All functions query Prisma directly — they are only called from Server
 * Components and are never imported into client bundles.
 */

import { prisma } from '@/lib/prisma';
import type { ReportStatus } from '@/types/index';
import { formatDate, formatDatetime } from '@/lib/format';

// ─── Today's report ────────────────────────────────────────────────────────────

export type TodayReportResult = {
  id: bigint;
  status: ReportStatus;
};

/**
 * Returns the daily report for `salespersonId` on `today` (YYYY-MM-DD), or
 * `null` if none exists.
 */
export async function getTodayReport(
  salespersonId: bigint,
  today: string
): Promise<TodayReportResult | null> {
  const report = await prisma.dailyReport.findUnique({
    where: {
      salespersonId_reportDate: {
        salespersonId,
        reportDate: new Date(today),
      },
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!report) return null;

  return {
    id: report.id,
    status: report.status as ReportStatus,
  };
}

// ─── Recent comments on own reports ───────────────────────────────────────────

const COMMENT_PREVIEW_LENGTH = 100;
const MAX_RECENT_COMMENTS = 5;

export type RecentCommentResult = {
  commentId: string;
  reportId: string;
  reportDate: string;
  commenterName: string;
  contentPreview: string;
  createdAt: string;
};

/**
 * Returns up to 5 most recent comments posted on `salespersonId`'s daily
 * reports, ordered by comment creation time descending.
 */
export async function getRecentCommentsForUser(
  salespersonId: bigint
): Promise<RecentCommentResult[]> {
  const comments = await prisma.comment.findMany({
    where: {
      dailyReport: {
        salespersonId,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: MAX_RECENT_COMMENTS,
    select: {
      id: true,
      content: true,
      createdAt: true,
      commenter: {
        select: { name: true },
      },
      dailyReport: {
        select: {
          id: true,
          reportDate: true,
        },
      },
    },
  });

  type CommentRow = (typeof comments)[number];

  return comments.map((c: CommentRow) => {
    const reportDate = formatDate(c.dailyReport.reportDate);
    const createdAt = formatDatetime(c.createdAt);
    const contentPreview =
      c.content.length > COMMENT_PREVIEW_LENGTH
        ? c.content.slice(0, COMMENT_PREVIEW_LENGTH) + '…'
        : c.content;

    return {
      commentId: String(c.id),
      reportId: String(c.dailyReport.id),
      reportDate,
      commenterName: c.commenter.name,
      contentPreview,
      createdAt,
    };
  });
}
