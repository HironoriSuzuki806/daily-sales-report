import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { getSessionUser } from '@/lib/session';
import { listDepartments } from '@/services/department.service';
import { listSalespersons, type SalespersonResponse } from '@/services/salesperson.service';

import {
  buildSalespersonsPath,
  parseSalespersonListParams,
  type SalespersonListParams,
} from './search-params';

export const metadata: Metadata = {
  title: '営業マスタ一覧 | 営業日報システム',
};

const PAGE_SIZE = 20;

// ─── search form ──────────────────────────────────────────────────────────────

type DepartmentOption = { id: number; name: string };

type SearchFormProps = {
  params: SalespersonListParams;
  departments: DepartmentOption[];
};

// URL クエリパラメータと form[method=GET] の連動のため shadcn/ui Select ではなくネイティブ select を使用
const selectClassName =
  'border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs ' +
  'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none';

function SearchForm({ params, departments }: SearchFormProps) {
  return (
    <Card>
      <CardContent>
        <form method="GET" action="/salespersons" className="grid gap-4 md:grid-cols-5">
          <div className="space-y-1.5">
            <label htmlFor="search-name" className="text-sm font-medium">
              氏名
            </label>
            <Input
              id="search-name"
              name="name"
              defaultValue={params.name ?? ''}
              placeholder="部分一致で検索"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="search-department" className="text-sm font-medium">
              所属部署
            </label>
            <select
              id="search-department"
              name="departmentId"
              defaultValue={params.departmentId ?? ''}
              className={selectClassName}
            >
              <option value="">すべて</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="search-role" className="text-sm font-medium">
              役割
            </label>
            <select
              id="search-role"
              name="role"
              defaultValue={params.role ?? ''}
              className={selectClassName}
            >
              <option value="">すべて</option>
              <option value="SALES">営業</option>
              <option value="MANAGER">上長</option>
              <option value="ADMIN">管理者</option>
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

// ─── salespersons table ───────────────────────────────────────────────────────

const ROLE_LABELS: Record<SalespersonResponse['role'], string> = {
  SALES: '営業',
  MANAGER: '上長',
  ADMIN: '管理者',
};

function RoleBadge({ role }: { role: SalespersonResponse['role'] }) {
  const label = ROLE_LABELS[role];
  if (role === 'ADMIN') return <Badge variant="destructive">{label}</Badge>;
  if (role === 'MANAGER') return <Badge variant="secondary">{label}</Badge>;
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {label}
    </Badge>
  );
}

function ActiveBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <Badge variant="success">有効</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      無効
    </Badge>
  );
}

function SalespersonsTable({ salespersons }: { salespersons: SalespersonResponse[] }) {
  if (salespersons.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-sm">営業が見つかりません。</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-border text-muted-foreground border-b text-left">
          <th scope="col" className="px-3 py-2 font-medium">
            氏名
          </th>
          <th scope="col" className="px-3 py-2 font-medium">
            メールアドレス
          </th>
          <th scope="col" className="px-3 py-2 font-medium">
            役割
          </th>
          <th scope="col" className="px-3 py-2 font-medium">
            所属部署
          </th>
          <th scope="col" className="px-3 py-2 font-medium">
            有効フラグ
          </th>
        </tr>
      </thead>
      <tbody>
        {salespersons.map((sp) => (
          <tr key={sp.id} className="border-border hover:bg-muted/50 relative border-b">
            <td className="px-3 py-2 font-medium">
              <Link
                href={`/salespersons/${sp.id}/edit`}
                className="focus-visible:ring-ring rounded after:absolute after:inset-0 hover:underline focus-visible:ring-2 focus-visible:outline-none"
              >
                {sp.name}
              </Link>
            </td>
            <td className="text-muted-foreground px-3 py-2">{sp.email}</td>
            <td className="px-3 py-2">
              <RoleBadge role={sp.role} />
            </td>
            <td className="text-muted-foreground px-3 py-2">{sp.department?.name ?? '—'}</td>
            <td className="px-3 py-2">
              <ActiveBadge isActive={sp.isActive} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── pagination ───────────────────────────────────────────────────────────────

type PaginationProps = {
  params: SalespersonListParams;
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
          href={buildSalespersonsPath(params, page - 1)}
          aria-disabled={!hasPrev}
          tabIndex={hasPrev ? undefined : -1}
          className={pageLinkClass(hasPrev)}
        >
          前へ
        </Link>
        <Link
          href={buildSalespersonsPath(params, page + 1)}
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

export default async function SalespersonsPage({ searchParams }: PageProps) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    redirect('/login');
  }
  if (sessionUser.role !== 'ADMIN') {
    redirect('/home');
  }

  const params = parseSalespersonListParams(await searchParams);

  const [salespersonsPage, departmentsPage] = await Promise.all([
    listSalespersons(
      {
        name: params.name,
        departmentId: params.departmentId !== undefined ? Number(params.departmentId) : undefined,
        role: params.role as SalespersonResponse['role'] | undefined,
        isActive: params.isActive !== undefined ? params.isActive === 'true' : undefined,
      },
      { page: params.page, size: PAGE_SIZE, sort: undefined }
    ),
    listDepartments({ isActive: true }, { page: 0, size: 1000 }), // 暫定上限1000件
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">営業マスタ一覧</h1>
        <Link href="/salespersons/new" className={cn(buttonVariants({ variant: 'default' }))}>
          新規登録
        </Link>
      </div>

      <SearchForm
        params={params}
        departments={departmentsPage.content.map((d) => ({ id: d.id, name: d.name }))}
      />

      <Card>
        <CardContent>
          <SalespersonsTable salespersons={salespersonsPage.content} />
        </CardContent>
      </Card>

      <Pagination
        params={params}
        page={salespersonsPage.page}
        totalPages={salespersonsPage.totalPages}
        totalElements={salespersonsPage.totalElements}
      />
    </div>
  );
}
