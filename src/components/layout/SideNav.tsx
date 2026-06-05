'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FileText, Users, UserSquare, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Role } from '@/types/auth';

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
};

const NAV_ITEMS: NavItem[] = [
  { label: 'ホーム', href: '/', icon: Home, roles: ['SALES', 'MANAGER', 'ADMIN'] },
  { label: '日報一覧', href: '/reports', icon: FileText, roles: ['SALES', 'MANAGER'] },
  { label: '顧客マスタ', href: '/master/customers', icon: Users, roles: ['ADMIN'] },
  { label: '営業マスタ', href: '/master/salespersons', icon: UserSquare, roles: ['ADMIN'] },
  { label: '部署マスタ', href: '/master/departments', icon: Building2, roles: ['ADMIN'] },
];

type SideNavProps = {
  role: Role;
};

export function SideNav({ role }: SideNavProps) {
  const pathname = usePathname();

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <nav className="bg-background flex w-56 flex-col gap-1 border-r p-4">
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
