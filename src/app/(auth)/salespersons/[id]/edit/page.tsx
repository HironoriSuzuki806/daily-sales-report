import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSessionUser } from '@/lib/session';
import { cn } from '@/lib/utils';
import { listDepartments } from '@/services/department.service';
import { getSalesperson } from '@/services/salesperson.service';

import { SalespersonForm } from '../../_components/salesperson-form';

type EditSalespersonPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditSalespersonPage({ params }: EditSalespersonPageProps) {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== 'ADMIN') {
    redirect('/home');
  }

  const { id } = await params;
  const salespersonId = parseInt(id, 10);
  if (isNaN(salespersonId)) {
    notFound();
  }

  let salesperson;
  try {
    salesperson = await getSalesperson(salespersonId);
  } catch {
    notFound();
  }

  const { content: departments } = await listDepartments(
    { isActive: true },
    { page: 0, size: 1000 }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/salespersons" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
          ← 営業マスタ
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">営業編集</h1>
        <p className="text-muted-foreground text-sm">{salesperson.name} の情報を編集します</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>営業情報</CardTitle>
        </CardHeader>
        <CardContent>
          <SalespersonForm
            mode="edit"
            salespersonId={salespersonId}
            defaultValues={{
              name: salesperson.name,
              email: salesperson.email,
              role: salesperson.role,
              departmentId: salesperson.department?.id ?? null,
              isActive: salesperson.isActive,
            }}
            departments={departments.map((d) => ({ id: d.id, name: d.name }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
