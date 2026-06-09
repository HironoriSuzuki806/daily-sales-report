import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { getSessionUser } from '@/lib/session';

/**
 * Layout for unauthenticated (public) pages such as /login.
 * If a session is already active, redirect to the home screen to prevent
 * double-login (acceptance criterion: authenticated user accessing /login
 * is redirected to /home).
 */
export default async function PublicLayout({ children }: { children: ReactNode }) {
  const session = await getSessionUser();
  if (session) {
    redirect('/home');
  }
  return <>{children}</>;
}
