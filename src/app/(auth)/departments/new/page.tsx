import Link from 'next/link';
import { redirect } from 'next/navigation';

import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSessionUser } from '@/lib/session';
import { cn } from '@/lib/utils';
import { listDepartments } from '@/services/department.service';
import { listSalespersons } from '@/services/salesperson.service';
import { DepartmentForm } from '../_components/department-form';

export default async function NewDepartmentPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== 'ADMIN') {
    redirect('/home');
  }

  const [{ content: departments }, { content: salespersons }] = await Promise.all([
    listDepartments({ isActive: true }, { page: 0, size: 1000 }),
    listSalespersons({ isActive: true }, { page: 0, size: 1000 }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/departments" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
          ← 部署マスタ
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">部署登録</h1>
        <p className="text-muted-foreground text-sm">新しい部署を登録します</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>部署情報</CardTitle>
        </CardHeader>
        <CardContent>
          <DepartmentForm
            mode="new"
            departments={departments.map((d) => ({ id: d.id, name: d.name }))}
            salespersons={(salespersons as { id: number; name: string }[]).map((s) => ({
              id: s.id,
              name: s.name,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
