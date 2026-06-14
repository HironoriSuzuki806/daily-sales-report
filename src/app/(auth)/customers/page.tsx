import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { getSessionUser } from '@/lib/session';
import { listCustomers, type CustomerResponse } from '@/services/customer.service';
import { listSalespersons } from '@/services/salesperson.service';

import {
  buildCustomersPath,
  parseCustomerListParams,
  type CustomerListParams,
} from './search-params';

export const metadata: Metadata = {
  title: '顧客マスタ一覧 | 営業日報システム',
};

const PAGE_SIZE = 20;

// ─── search form ──────────────────────────────────────────────────────────────

type SalespersonOption = { id: number; name: string };

type SearchFormProps = {
  params: CustomerListParams;
  salespersons: SalespersonOption[];
};

const selectClassName =
  'border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs ' +
  'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none';

function SearchForm({ params, salespersons }: SearchFormProps) {
  return (
    <Card>
      <CardContent>
        <form method="GET" action="/customers" className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1.5">
            <label htmlFor="search-name" className="text-sm font-medium">
              顧客名
            </label>
            <Input
              id="search-name"
              name="name"
              defaultValue={params.name ?? ''}
              placeholder="部分一致で検索"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="search-sales-rep" className="text-sm font-medium">
              担当営業
            </label>
            <select
              id="search-sales-rep"
              name="salesRepId"
              defaultValue={params.salesRepId ?? ''}
              className={selectClassName}
            >
              <option value="">すべて</option>
              {salespersons.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}
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

// ─── customers table ──────────────────────────────────────────────────────────

function ActiveBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <Badge variant="success">有効</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      無効
    </Badge>
  );
}

function CustomersTable({ customers }: { customers: CustomerResponse[] }) {
  if (customers.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-sm">顧客が見つかりません。</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-border text-muted-foreground border-b text-left">
          <th scope="col" className="px-3 py-2 font-medium">
            顧客名
          </th>
          <th scope="col" className="px-3 py-2 font-medium">
            住所
          </th>
          <th scope="col" className="px-3 py-2 font-medium">
            電話番号
          </th>
          <th scope="col" className="px-3 py-2 font-medium">
            担当営業
          </th>
          <th scope="col" className="px-3 py-2 font-medium">
            有効フラグ
          </th>
        </tr>
      </thead>
      <tbody>
        {customers.map((customer) => (
          <tr key={customer.id} className="border-border hover:bg-muted/50 relative border-b">
            <td className="px-3 py-2 font-medium">
              <Link
                href={`/customers/${customer.id}`}
                className="focus-visible:ring-ring rounded after:absolute after:inset-0 hover:underline focus-visible:ring-2 focus-visible:outline-none"
              >
                {customer.name}
              </Link>
            </td>
            <td className="text-muted-foreground px-3 py-2">{customer.address ?? '-'}</td>
            <td className="text-muted-foreground px-3 py-2">{customer.phone ?? '-'}</td>
            <td className="px-3 py-2">{customer.salesRep?.name ?? '-'}</td>
            <td className="px-3 py-2">
              <ActiveBadge isActive={customer.isActive} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── pagination ───────────────────────────────────────────────────────────────

type PaginationProps = {
  params: CustomerListParams;
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
          href={buildCustomersPath(params, page - 1)}
          aria-disabled={!hasPrev}
          tabIndex={hasPrev ? undefined : -1}
          className={pageLinkClass(hasPrev)}
        >
          前へ
        </Link>
        <Link
          href={buildCustomersPath(params, page + 1)}
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

export default async function CustomersPage({ searchParams }: PageProps) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    redirect('/login');
  }
  if (sessionUser.role !== 'ADMIN') {
    redirect('/home');
  }

  const params = parseCustomerListParams(await searchParams);

  const [customersPage, salespersonsPage] = await Promise.all([
    listCustomers(
      {
        name: params.name,
        salesRepId: params.salesRepId !== undefined ? Number(params.salesRepId) : undefined,
        isActive: params.isActive !== undefined ? params.isActive === 'true' : undefined,
      },
      { page: params.page, size: PAGE_SIZE, sort: undefined }
    ),
    listSalespersons({ isActive: true }, { page: 0, size: 100, sort: undefined }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">顧客マスタ一覧</h1>
        <Link href="/customers/new" className={cn(buttonVariants({ variant: 'default' }))}>
          新規登録
        </Link>
      </div>

      <SearchForm
        params={params}
        salespersons={salespersonsPage.content.map((sp) => ({ id: sp.id, name: sp.name }))}
      />

      <Card>
        <CardContent>
          <CustomersTable customers={customersPage.content} />
        </CardContent>
      </Card>

      <Pagination
        params={params}
        page={customersPage.page}
        totalPages={customersPage.totalPages}
        totalElements={customersPage.totalElements}
      />
    </div>
  );
}
