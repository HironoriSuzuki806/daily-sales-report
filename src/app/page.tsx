import { redirect } from 'next/navigation';

import { getSessionUser } from '@/lib/session';

export default async function RootPage() {
  const session = await getSessionUser();
  if (session) {
    redirect('/home');
  }
  redirect('/login');
}
