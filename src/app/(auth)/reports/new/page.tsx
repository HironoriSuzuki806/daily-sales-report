import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getSessionUser } from '@/lib/session';
import { listCustomers } from '@/services/customer.service';

import { DailyReportForm } from '../_components/daily-report-form';

export const metadata: Metadata = {
  title: '日報作成 | 営業日報システム',
};

export default async function NewReportPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect('/login');
  if (sessionUser.role === 'ADMIN') redirect('/home');

  const { content: customers } = await listCustomers(
    { isActive: true },
    { page: 0, size: 1000, sort: undefined }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/reports" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
          ← 日報一覧
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">日報作成</h1>
        <p className="text-muted-foreground text-sm">新しい日報を作成します</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>日報情報</CardTitle>
        </CardHeader>
        <CardContent>
          <DailyReportForm
            mode="new"
            salespersonName={sessionUser.name}
            customers={customers.map((c) => ({ id: c.id, name: c.name }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
