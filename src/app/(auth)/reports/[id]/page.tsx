import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatDatetimeDisplay } from '@/lib/format';
import { getSessionUser } from '@/lib/session';
import { getDailyReport } from '@/services/daily-report.service';

import { CommentForm } from './_components/comment-form';

export const metadata: Metadata = {
  title: '日報詳細 | 営業日報システム',
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ReportDetailPage({ params }: PageProps) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect('/login');
  if (sessionUser.role === 'ADMIN') redirect('/home');

  const { id: rawId } = await params;
  const reportId = parseInt(rawId, 10);
  if (!Number.isFinite(reportId) || !Number.isSafeInteger(reportId)) notFound();

  const requesterId = Number(sessionUser.sub);
  const role = sessionUser.role as 'SALES' | 'MANAGER';
  const departmentId = sessionUser.departmentId ? Number(sessionUser.departmentId) : null;

  let report;
  try {
    report = await getDailyReport(reportId, requesterId, role, departmentId);
  } catch {
    notFound();
  }

  const isOwnReport = report.salesperson.id === requesterId;
  const isOwnDraft = isOwnReport && report.status === 'DRAFT';
  const isManager = role === 'MANAGER';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/reports" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
          ← 日報一覧
        </Link>
        {isOwnDraft && (
          <Link
            href={`/reports/${reportId}/edit`}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            編集
          </Link>
        )}
      </div>

      {/* ヘッダ情報 */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>{report.reportDate} の日報</CardTitle>
            <Badge variant={report.status === 'SUBMITTED' ? 'success' : 'secondary'}>
              {report.status === 'SUBMITTED' ? '提出済' : '下書き'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground">営業担当</span>
              <p className="mt-0.5 font-medium">{report.salesperson.name}</p>
            </div>
            {report.submittedAt && (
              <div>
                <span className="text-muted-foreground">提出日時</span>
                <p className="mt-0.5 font-medium">{formatDatetimeDisplay(report.submittedAt)}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 訪問記録 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">訪問記録（{report.visitRecords.length} 件）</CardTitle>
        </CardHeader>
        <CardContent>
          {report.visitRecords.length === 0 ? (
            <p className="text-muted-foreground text-sm">訪問記録がありません。</p>
          ) : (
            <ol className="space-y-4">
              {report.visitRecords.map((vr, index) => (
                <li key={vr.id} className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs font-medium">{index + 1}.</span>
                    <span className="font-medium">{vr.customer?.name ?? '（顧客未設定）'}</span>
                    {vr.visitTime && (
                      <span className="text-muted-foreground text-xs">{vr.visitTime}</span>
                    )}
                  </div>
                  {vr.visitContent && (
                    <p className="text-muted-foreground pl-4 whitespace-pre-wrap">
                      {vr.visitContent}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* 所感 */}
      {(report.problem || report.plan) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">所感</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {report.problem && (
              <div className="space-y-1">
                <p className="text-muted-foreground font-medium">課題・相談（Problem）</p>
                <p className="whitespace-pre-wrap">{report.problem}</p>
              </div>
            )}
            {report.plan && (
              <div className="space-y-1">
                <p className="text-muted-foreground font-medium">翌日の予定（Plan）</p>
                <p className="whitespace-pre-wrap">{report.plan}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* コメントスレッド */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">コメント（{report.comments.length} 件）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {report.comments.length === 0 ? (
            <p className="text-muted-foreground text-sm">コメントはありません。</p>
          ) : (
            <ul className="space-y-4">
              {report.comments.map((comment) => (
                <li key={comment.id} className="space-y-1 border-b pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium">{comment.commenter.name}</span>
                    <span className="text-muted-foreground">
                      {formatDatetimeDisplay(comment.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                </li>
              ))}
            </ul>
          )}

          {isManager && (
            <div className="border-t pt-4">
              <CommentForm reportId={reportId} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
