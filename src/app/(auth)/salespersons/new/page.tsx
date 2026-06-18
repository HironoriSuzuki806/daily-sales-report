import Link from 'next/link';
import { redirect } from 'next/navigation';

import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSessionUser } from '@/lib/session';
import { cn } from '@/lib/utils';
import { listDepartments } from '@/services/department.service';

import { SalespersonForm } from '../_components/salesperson-form';

export default async function NewSalespersonPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== 'ADMIN') {
    redirect('/home');
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
        <h1 className="text-2xl font-semibold tracking-tight">営業登録</h1>
        <p className="text-muted-foreground text-sm">新しい営業担当者を登録します</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>営業情報</CardTitle>
        </CardHeader>
        <CardContent>
          <SalespersonForm
            mode="new"
            departments={departments.map((d) => ({ id: d.id, name: d.name }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
