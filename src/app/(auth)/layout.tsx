import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { Header } from '@/components/layout/header';
import { SideNav } from '@/components/layout/side-nav';
import { getSessionUser } from '@/lib/session';
import type { SessionUser } from '@/types/auth';

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const payload = await getSessionUser();

  if (!payload) {
    redirect('/login');
  }

  const user: SessionUser = {
    id: payload.sub,
    name: payload.name,
    email: payload.email,
    role: payload.role,
    departmentId: payload.departmentId,
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header user={user} />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <SideNav role={user.role} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
