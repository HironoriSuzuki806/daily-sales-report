import type { ReactNode } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { SideNav } from '@/components/layout/SideNav';
import type { Role } from '@/types/auth';

const DEMO_USER_NAME = '山田太郎';
const DEMO_ROLE: Role = 'ADMIN';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <AppHeader userName={DEMO_USER_NAME} />
      <div className="flex min-h-0 flex-1">
        <SideNav role={DEMO_ROLE} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
