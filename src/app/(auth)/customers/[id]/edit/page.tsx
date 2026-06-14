import { notFound, redirect } from 'next/navigation';

import { CustomerForm } from '@/components/customers/customer-form';
import { getSessionUser } from '@/lib/session';
import { getCustomer } from '@/services/customer.service';

export default async function CustomerEditPage({ params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser();
  if (sessionUser?.role !== 'ADMIN') {
    redirect('/home');
  }

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) {
    notFound();
  }

  let customer;
  try {
    customer = await getCustomer(id);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">顧客マスタ編集</h1>
      <CustomerForm customer={customer} />
    </div>
  );
}
