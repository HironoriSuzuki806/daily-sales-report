import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getSessionUser } from '@/lib/session';
import { listDailyReports, type DailyReportSummaryResponse } from '@/services/daily-report.service';
import { listSalespersons } from '@/services/salesperson.service';

import {
  buildReportsPath,
  parseDailyReportListParams,
  type DailyReportListParams,
} from './search-params';

export const metadata: Metadata = {
  title: '日報一覧 | 営業日報システム',
};

const PAGE_SIZE = 20;

// ─── search form ──────────────────────────────────────────────────────────────

type SalespersonOption = { id: number; name: string };

type SearchFormProps = {
  params: DailyReportListParams;
  isManager: boolean;
  salespersonOptions: SalespersonOption[];
};

// URL クエリパラメータと form[method=GET] の連動のため shadcn/ui Select ではなくネイティブ select を使用
const selectClassName =
  'border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs ' +
  'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none';

function SearchForm({ params, isManager, salespersonOptions }: SearchFormProps) {
  return (
    <Card>
      <CardContent>
        <form method="GET" action="/reports" className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <div className="space-y-1.5">
            <label htmlFor="search-date-from" className="text-sm font-medium">
              報告日（From）
            </label>
            <input
              id="search-date-from"
              name="dateFrom"
              type="date"
              defaultValue={params.dateFrom ?? ''}
              className={selectClassName}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="search-date-to" className="text-sm font-medium">
              報告日（To）
            </label>
            <input
              id="search-date-to"
              name="dateTo"
              type="date"
              defaultValue={params.dateTo ?? ''}
              className={selectClassName}
            />
          </div>

          {isManager && (
            <div className="space-y-1.5">
              <label htmlFor="search-salesperson" className="text-sm font-medium">
                営業担当
              </label>
              <select
                id="search-salesperson"
                name="salespersonId"
                defaultValue={params.salespersonId ?? ''}
                className={selectClassName}
              >
                <option value="">すべて</option>
                {salespersonOptions.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="search-status" className="text-sm font-medium">
              ステータス
            </label>
            <select
              id="search-status"
              name="status"
              defaultValue={params.status ?? ''}
              className={selectClassName}
            >
              <option value="">すべて</option>
              <option value="DRAFT">下書き</option>
              <option value="SUBMITTED">提出済</option>
            </select>
          </div>

          <div className="flex items-end">
            <Button type="submit">検索</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── table ────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: DailyReportSummaryResponse['status'] }) {
  if (status === 'SUBMITTED') return <Badge variant="success">提出済</Badge>;
  return <Badge variant="secondary">下書き</Badge>;
}

type ReportTableProps = {
  reports: DailyReportSummaryResponse[];
  currentUserId: number;
};

function ReportsTable({ reports, currentUserId }: ReportTableProps) {
  if (reports.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-sm">日報が見つかりません。</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-border text-muted-foreground border-b text-left">
          <th scope="col" className="px-3 py-2 font-medium">
            報告日
          </th>
          <th scope="col" className="px-3 py-2 font-medium">
            営業担当
          </th>
          <th scope="col" className="px-3 py-2 font-medium">
            訪問件数
          </th>
          <th scope="col" className="px-3 py-2 font-medium">
            ステータス
          </th>
          <th scope="col" className="px-3 py-2 font-medium">
            コメント
          </th>
        </tr>
      </thead>
      <tbody>
        {reports.map((report) => {
          const isOwnDraft = report.salesperson.id === currentUserId && report.status === 'DRAFT';
          return (
            <tr key={report.id} className="border-border hover:bg-muted/50 relative border-b">
              <td className="px-3 py-2 font-medium">
                <Link
                  href={`/reports/${report.id}`}
                  className="focus-visible:ring-ring rounded after:absolute after:inset-0 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                >
                  {report.reportDate}
                </Link>
              </td>
              <td className="text-muted-foreground px-3 py-2">{report.salesperson.name}</td>
              <td className="text-muted-foreground px-3 py-2">{report.visitCount}</td>
              <td className="px-3 py-2">
                <StatusBadge status={report.status} />
              </td>
              <td className="px-3 py-2">
                {isOwnDraft ? (
                  <Link
                    href={`/reports/${report.id}/edit`}
                    className="focus-visible:ring-ring relative z-10 text-xs underline focus-visible:ring-2 focus-visible:outline-none"
                  >
                    編集
                  </Link>
                ) : (
                  <span className="text-muted-foreground">
                    {report.commentCount > 0 ? `${report.commentCount} 件` : '—'}
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── pagination ───────────────────────────────────────────────────────────────

type PaginationProps = {
  params: DailyReportListParams;
  page: number;
  totalPages: number;
  totalElements: number;
};

function Pagination({ params, page, totalPages, totalElements }: PaginationProps) {
  if (totalElements === 0) return null;

  const hasPrev = page > 0;
  const hasNext = page < totalPages - 1;

  const pageLinkClass = (enabled: boolean) =>
    cn(
      buttonVariants({ variant: 'outline', size: 'sm' }),
      !enabled && 'pointer-events-none opacity-50'
    );

  return (
    <nav className="flex items-center justify-between" aria-label="ページネーション">
      <p className="text-muted-foreground text-sm">
        全 {totalElements} 件中 {page + 1} / {Math.max(totalPages, 1)} ページ
      </p>
      <div className="flex gap-2">
        <Link
          href={buildReportsPath(params, page - 1)}
          aria-disabled={!hasPrev}
          tabIndex={hasPrev ? undefined : -1}
          className={pageLinkClass(hasPrev)}
        >
          前へ
        </Link>
        <Link
          href={buildReportsPath(params, page + 1)}
          aria-disabled={!hasNext}
          tabIndex={hasNext ? undefined : -1}
          className={pageLinkClass(hasNext)}
        >
          次へ
        </Link>
      </div>
    </nav>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReportsPage({ searchParams }: PageProps) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    redirect('/login');
  }
  if (sessionUser.role === 'ADMIN') {
    redirect('/home');
  }

  const requesterId = Number(sessionUser.sub);
  const role = sessionUser.role as 'SALES' | 'MANAGER';
  const departmentId = sessionUser.departmentId ? Number(sessionUser.departmentId) : null;
  const isManager = role === 'MANAGER';

  const params = parseDailyReportListParams(await searchParams);

  const [reportsPage, salespersonsPage] = await Promise.all([
    listDailyReports(
      requesterId,
      role,
      departmentId,
      {
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        salespersonId: params.salespersonId ? Number(params.salespersonId) : undefined,
        status: params.status as 'DRAFT' | 'SUBMITTED' | undefined,
      },
      { page: params.page, size: PAGE_SIZE, sort: undefined }
    ),
    isManager && departmentId !== null
      ? listSalespersons({ departmentId, isActive: true }, { page: 0, size: 200, sort: undefined })
      : Promise.resolve(null),
  ]);

  const salespersonOptions =
    salespersonsPage?.content.map((sp) => ({ id: sp.id, name: sp.name })) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">日報一覧</h1>
        <Link href="/reports/new" className={cn(buttonVariants({ variant: 'default' }))}>
          新規作成
        </Link>
      </div>

      <SearchForm params={params} isManager={isManager} salespersonOptions={salespersonOptions} />

      <Card>
        <CardContent>
          <ReportsTable reports={reportsPage.content} currentUserId={requesterId} />
        </CardContent>
      </Card>

      <Pagination
        params={params}
        page={reportsPage.page}
        totalPages={reportsPage.totalPages}
        totalElements={reportsPage.totalElements}
      />
    </div>
  );
}
