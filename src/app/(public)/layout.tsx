import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { getSessionUser } from '@/lib/session';

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const session = await getSessionUser();
  if (session) {
    redirect('/home');
  }
  return <>{children}</>;
}
