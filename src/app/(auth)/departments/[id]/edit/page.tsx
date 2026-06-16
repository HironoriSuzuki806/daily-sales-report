import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSessionUser } from '@/lib/session';
import { cn } from '@/lib/utils';
import { getDepartment, listDepartments } from '@/services/department.service';
import { listSalespersons } from '@/services/salesperson.service';
import { DepartmentForm } from '../../_components/department-form';

type EditDepartmentPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditDepartmentPage({ params }: EditDepartmentPageProps) {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== 'ADMIN') {
    redirect('/home');
  }

  const { id } = await params;
  const departmentId = parseInt(id, 10);
  if (isNaN(departmentId)) {
    notFound();
  }

  let department;
  try {
    department = await getDepartment(departmentId);
  } catch {
    notFound();
  }

  const [{ content: departments }, { content: salespersons }] = await Promise.all([
    listDepartments({ isActive: true }, { page: 0, size: 1000 }),
    listSalespersons({ isActive: true }, { page: 0, size: 1000 }),
  ]);

  // Exclude self from parent department dropdown
  const availableParents = departments.filter((d) => d.id !== departmentId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/departments" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
          ← 部署マスタ
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">部署編集</h1>
        <p className="text-muted-foreground text-sm">{department.name} の情報を編集します</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>部署情報</CardTitle>
        </CardHeader>
        <CardContent>
          <DepartmentForm
            mode="edit"
            departmentId={departmentId}
            defaultValues={{
              name: department.name,
              parentDepartmentId: department.parentDepartment?.id ?? null,
              managerId: department.manager?.id ?? null,
              isActive: department.isActive,
            }}
            departments={availableParents.map((d) => ({ id: d.id, name: d.name }))}
            salespersons={salespersons.map((s) => ({
              id: s.id,
              name: s.name,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
