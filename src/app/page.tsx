import { redirect } from 'next/navigation';

import { getSessionUser } from '@/lib/session';

/**
 * Root route (`/`).
 * - Authenticated users  → /home  (SCR-002)
 * - Unauthenticated users → /login (SCR-001)
 */
export default async function RootPage() {
  const session = await getSessionUser();
  if (session) {
    redirect('/home');
  }
  redirect('/login');
}
