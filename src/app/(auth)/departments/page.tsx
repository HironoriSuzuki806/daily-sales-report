import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getSessionUser } from '@/lib/session';
import { cn } from '@/lib/utils';
import type { DepartmentResponse } from '@/services/department.service';
import { listDepartments } from '@/services/department.service';

import {
  buildDepartmentsPath,
  parseDepartmentListParams,
  type DepartmentListParams,
} from './search-params';

export const metadata: Metadata = {
  title: '部署マスタ一覧 | 営業日報システム',
};

const PAGE_SIZE = 20;

// ─── search form ──────────────────────────────────────────────────────────────

type DepartmentOption = { id: number; name: string };

type SearchFormProps = {
  params: DepartmentListParams;
  parentDepartments: DepartmentOption[];
};

// URL クエリパラメータと form[method=GET] の連動のため shadcn/ui Select ではなくネイティブ select を使用
const selectClassName =
  'border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs ' +
  'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none';

function SearchForm({ params, parentDepartments }: SearchFormProps) {
  return (
    <Card>
      <CardContent>
        <form method="GET" action="/departments" className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1.5">
            <label htmlFor="search-name" className="text-sm font-medium">
              部署名
            </label>
            <Input
              id="search-name"
              name="name"
              defaultValue={params.name ?? ''}
              placeholder="部分一致で検索"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="search-parent" className="text-sm font-medium">
              上位部署
            </label>
            <select
              id="search-parent"
              name="parentDepartmentId"
              defaultValue={params.parentDepartmentId ?? ''}
              className={selectClassName}
            >
              <option value="">すべて</option>
              {parentDepartments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="search-is-active" className="text-sm font-medium">
              有効フラグ
            </label>
            <select
              id="search-is-active"
              name="isActive"
              defaultValue={params.isActive ?? ''}
              className={selectClassName}
            >
              <option value="">すべて</option>
              <option value="true">有効</option>
              <option value="false">無効</option>
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

// ─── departments table ────────────────────────────────────────────────────────

function ActiveBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <Badge variant="success">有効</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      無効
    </Badge>
  );
}

function DepartmentsTable({ departments }: { departments: DepartmentResponse[] }) {
  if (departments.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-sm">部署が見つかりません。</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-border text-muted-foreground border-b text-left">
          <th scope="col" className="px-3 py-2 font-medium">
            部署名
          </th>
          <th scope="col" className="px-3 py-2 font-medium">
            上位部署
          </th>
          <th scope="col" className="px-3 py-2 font-medium">
            部署長
          </th>
          <th scope="col" className="px-3 py-2 font-medium">
            有効フラグ
          </th>
        </tr>
      </thead>
      <tbody>
        {departments.map((dept) => (
          <tr key={dept.id} className="border-border hover:bg-muted/50 relative border-b">
            <td className="px-3 py-2 font-medium">
              <Link
                href={`/departments/${dept.id}/edit`}
                className="focus-visible:ring-ring rounded after:absolute after:inset-0 hover:underline focus-visible:ring-2 focus-visible:outline-none"
              >
                {dept.name}
              </Link>
            </td>
            <td className="text-muted-foreground px-3 py-2">
              {dept.parentDepartment?.name ?? '—'}
            </td>
            <td className="text-muted-foreground px-3 py-2">{dept.manager?.name ?? '—'}</td>
            <td className="px-3 py-2">
              <ActiveBadge isActive={dept.isActive} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── pagination ───────────────────────────────────────────────────────────────

type PaginationProps = {
  params: DepartmentListParams;
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
          href={buildDepartmentsPath(params, page - 1)}
          aria-disabled={!hasPrev}
          tabIndex={hasPrev ? undefined : -1}
          className={pageLinkClass(hasPrev)}
        >
          前へ
        </Link>
        <Link
          href={buildDepartmentsPath(params, page + 1)}
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

export default async function DepartmentsPage({ searchParams }: PageProps) {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== 'ADMIN') {
    redirect('/home');
  }

  const params = parseDepartmentListParams(await searchParams);

  const [departmentsPage, allDepartmentsPage] = await Promise.all([
    listDepartments(
      {
        name: params.name,
        parentDepartmentId:
          params.parentDepartmentId !== undefined ? Number(params.parentDepartmentId) : undefined,
        isActive: params.isActive !== undefined ? params.isActive === 'true' : undefined,
      },
      { page: params.page, size: PAGE_SIZE }
    ),
    listDepartments({ isActive: true }, { page: 0, size: 1000 }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">部署マスタ一覧</h1>
        <Link href="/departments/new" className={cn(buttonVariants({ variant: 'default' }))}>
          新規登録
        </Link>
      </div>

      <SearchForm
        params={params}
        parentDepartments={allDepartmentsPage.content.map((d) => ({ id: d.id, name: d.name }))}
      />

      <Card>
        <CardContent>
          <DepartmentsTable departments={departmentsPage.content} />
        </CardContent>
      </Card>

      <Pagination
        params={params}
        page={departmentsPage.page}
        totalPages={departmentsPage.totalPages}
        totalElements={departmentsPage.totalElements}
      />
    </div>
  );
}
