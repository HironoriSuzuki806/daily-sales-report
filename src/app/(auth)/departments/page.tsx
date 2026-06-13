import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSessionUser } from '@/lib/session';
import { cn } from '@/lib/utils';
import type { DepartmentResponse } from '@/services/department.service';
import { listDepartments } from '@/services/department.service';

export default async function DepartmentsPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== 'ADMIN') {
    redirect('/home');
  }

  const { content: departments } = await listDepartments({}, { page: 0, size: 100 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">部署マスタ</h1>
          <p className="text-muted-foreground text-sm">部署の一覧・管理</p>
        </div>
        <Link href="/departments/new" className={cn(buttonVariants({ variant: 'default' }))}>
          新規登録
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>部署一覧</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {departments.length === 0 ? (
            <p className="text-muted-foreground px-6 py-4 text-sm">部署が登録されていません。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-6 py-3 text-left font-medium">部署名</th>
                    <th className="px-6 py-3 text-left font-medium">上位部署</th>
                    <th className="px-6 py-3 text-left font-medium">部署長</th>
                    <th className="px-6 py-3 text-left font-medium">有効</th>
                    <th className="px-6 py-3 text-left font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {departments.map((dept: DepartmentResponse) => (
                    <tr key={dept.id} className="hover:bg-muted/50">
                      <td className="px-6 py-3 font-medium">{dept.name}</td>
                      <td className="text-muted-foreground px-6 py-3">
                        {dept.parentDepartment?.name ?? '—'}
                      </td>
                      <td className="text-muted-foreground px-6 py-3">
                        {dept.manager?.name ?? '—'}
                      </td>
                      <td className="px-6 py-3">
                        {dept.isActive ? (
                          <Badge variant="success">有効</Badge>
                        ) : (
                          <Badge variant="outline">無効</Badge>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <Link
                          href={`/departments/${dept.id}/edit`}
                          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                        >
                          編集
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
