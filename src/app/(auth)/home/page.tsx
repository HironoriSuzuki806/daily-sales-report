import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getSessionUser } from '@/lib/session';
import { getTodayReport, getRecentCommentsForUser } from '@/lib/home-data';
import type { ReportStatus } from '@/types/index';

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  // Input: YYYY-MM-DDTHH:mm:ss  → Display: YYYY-MM-DD HH:mm
  return iso.replace('T', ' ').slice(0, 16);
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getTodayString(): string {
  return formatDate(new Date());
}

// ─── status badge ─────────────────────────────────────────────────────────────

type StatusBadgeProps = {
  status: ReportStatus | 'NONE';
};

function StatusBadge({ status }: StatusBadgeProps) {
  if (status === 'NONE') {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        未作成
      </Badge>
    );
  }
  if (status === 'DRAFT') {
    return <Badge variant="secondary">下書き</Badge>;
  }
  return <Badge className="bg-green-600 text-white hover:bg-green-700">提出済</Badge>;
}

// ─── today's report section ───────────────────────────────────────────────────

type TodayReportCardProps = {
  reportId: string | null;
  status: ReportStatus | 'NONE';
  today: string;
};

function TodayReportCard({ reportId, status, today }: TodayReportCardProps) {
  let actionHref: string;
  let actionLabel: string;

  if (status === 'NONE') {
    actionHref = `/reports/new?date=${today}`;
    actionLabel = '本日の日報を書く';
  } else if (status === 'DRAFT') {
    actionHref = `/reports/${reportId}/edit`;
    actionLabel = '続きから編集';
  } else {
    actionHref = `/reports/${reportId}`;
    actionLabel = '日報を確認する';
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>本日の日報</CardTitle>
          <StatusBadge status={status} />
        </div>
        <CardDescription>{today}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link href={actionHref} className={cn(buttonVariants({ variant: 'default' }))}>
          {actionLabel}
        </Link>
      </CardContent>
    </Card>
  );
}

// ─── recent comments section ──────────────────────────────────────────────────

type RecentComment = {
  commentId: string;
  reportId: string;
  reportDate: string;
  commenterName: string;
  contentPreview: string;
  createdAt: string;
};

type RecentCommentsCardProps = {
  comments: RecentComment[];
};

function RecentCommentsCard({ comments }: RecentCommentsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>最近のコメント</CardTitle>
        <CardDescription>自分の日報に付いたコメント</CardDescription>
      </CardHeader>
      <CardContent>
        {comments.length === 0 ? (
          <p className="text-muted-foreground text-sm">コメントはまだありません。</p>
        ) : (
          <ul className="divide-border divide-y" aria-label="最近のコメント一覧">
            {comments.map((c) => (
              <li key={c.commentId} className="py-3 first:pt-0 last:pb-0">
                <Link
                  href={`/reports/${c.reportId}`}
                  className="group focus-visible:ring-ring block space-y-0.5 rounded focus-visible:ring-2 focus-visible:outline-none"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium group-hover:underline">
                      {c.commenterName}
                    </span>
                    <time dateTime={c.createdAt} className="text-muted-foreground shrink-0 text-xs">
                      {formatDateTime(c.createdAt)}
                    </time>
                  </div>
                  <p className="text-muted-foreground text-xs">日報: {c.reportDate}</p>
                  <p className="text-foreground line-clamp-2 text-sm">{c.contentPreview}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ─── quick links section ──────────────────────────────────────────────────────

type QuickLinksCardProps = {
  isAdmin: boolean;
};

function QuickLinksCard({ isAdmin }: QuickLinksCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>クイックリンク</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Link href="/reports" className={cn(buttonVariants({ variant: 'outline' }))}>
          日報一覧
        </Link>
        {isAdmin && (
          <>
            <Link href="/customers" className={cn(buttonVariants({ variant: 'outline' }))}>
              顧客マスタ
            </Link>
            <Link href="/salespersons" className={cn(buttonVariants({ variant: 'outline' }))}>
              営業マスタ
            </Link>
            <Link href="/departments" className={cn(buttonVariants({ variant: 'outline' }))}>
              部署マスタ
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    redirect('/login');
  }

  const salespersonId = BigInt(sessionUser.sub);
  const today = getTodayString();

  const [todayReport, recentComments] = await Promise.all([
    getTodayReport(salespersonId, today),
    getRecentCommentsForUser(salespersonId),
  ]);

  const reportStatus: ReportStatus | 'NONE' = todayReport === null ? 'NONE' : todayReport.status;

  const reportId = todayReport ? String(todayReport.id) : null;

  const isAdmin = sessionUser.role === 'ADMIN';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          こんにちは、{sessionUser.name} さん
        </h1>
        <p className="text-muted-foreground text-sm">{today}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TodayReportCard reportId={reportId} status={reportStatus} today={today} />
        <RecentCommentsCard comments={recentComments} />
      </div>

      <QuickLinksCard isAdmin={isAdmin} />
    </div>
  );
}
