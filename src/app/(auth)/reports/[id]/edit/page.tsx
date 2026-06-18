import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getSessionUser } from '@/lib/session';
import { listCustomers } from '@/services/customer.service';
import { getDailyReport } from '@/services/daily-report.service';

import { DailyReportForm } from '../../_components/daily-report-form';

export const metadata: Metadata = {
  title: '日報編集 | 営業日報システム',
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditReportPage({ params }: PageProps) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect('/login');
  if (sessionUser.role === 'ADMIN') redirect('/home');

  const { id: rawId } = await params;
  const reportId = parseInt(rawId, 10);
  if (isNaN(reportId)) notFound();

  const requesterId = Number(sessionUser.sub);
  const role = sessionUser.role as 'SALES' | 'MANAGER';
  const departmentId = sessionUser.departmentId ? Number(sessionUser.departmentId) : null;

  let report;
  try {
    report = await getDailyReport(reportId, requesterId, role, departmentId);
  } catch {
    notFound();
  }

  // Only own DRAFT reports are editable
  if (report.salesperson.id !== requesterId || report.status !== 'DRAFT') {
    redirect(`/reports/${reportId}`);
  }

  const { content: customers } = await listCustomers(
    { isActive: true },
    { page: 0, size: 1000, sort: undefined }
  );

  const defaultValues = {
    reportDate: report.reportDate,
    visitRecords: report.visitRecords.map((vr) => ({
      customerId: vr.customer ? String(vr.customer.id) : '',
      visitTime: vr.visitTime ?? '',
      visitContent: vr.visitContent ?? '',
    })),
    problem: report.problem ?? '',
    plan: report.plan ?? '',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href={`/reports/${reportId}`}
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
        >
          ← 日報詳細
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">日報編集</h1>
        <p className="text-muted-foreground text-sm">{report.reportDate} の日報を編集します</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>日報情報</CardTitle>
        </CardHeader>
        <CardContent>
          <DailyReportForm
            mode="edit"
            reportId={reportId}
            salespersonName={report.salesperson.name}
            customers={customers.map((c) => ({ id: c.id, name: c.name }))}
            defaultValues={defaultValues}
          />
        </CardContent>
      </Card>
    </div>
  );
}
