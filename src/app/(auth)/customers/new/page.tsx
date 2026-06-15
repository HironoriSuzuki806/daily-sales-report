import { redirect } from 'next/navigation';

import { CustomerForm } from '@/components/customers/customer-form';
import { getSessionUser } from '@/lib/session';

export default async function CustomerNewPage() {
  const sessionUser = await getSessionUser();
  if (sessionUser?.role !== 'ADMIN') {
    redirect('/home');
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">顧客マスタ登録</h1>
      <CustomerForm />
    </div>
  );
}
