'use client';

import { BookText, Building2, Home, UserRound, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';
import type { Role } from '@/types/index';

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  /** Roles that can see this item. If omitted, all authenticated roles can see it. */
  allowedRoles?: Role[];
};

const NAV_ITEMS: NavItem[] = [
  {
    label: 'ホーム',
    href: '/home',
    icon: Home,
  },
  {
    label: '日報一覧',
    href: '/reports',
    icon: BookText,
    allowedRoles: ['SALES', 'MANAGER'],
  },
  {
    label: '顧客マスタ',
    href: '/customers',
    icon: Building2,
    allowedRoles: ['ADMIN'],
  },
  {
    label: '営業マスタ',
    href: '/salespersons',
    icon: UserRound,
    allowedRoles: ['ADMIN'],
  },
  {
    label: '部署マスタ',
    href: '/departments',
    icon: Users,
    allowedRoles: ['ADMIN'],
  },
];

type SideNavProps = {
  role: Role;
};

export function SideNav({ role }: SideNavProps) {
  const pathname = usePathname();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.allowedRoles || item.allowedRoles.includes(role)
  );

  return (
    <nav
      className="bg-sidebar border-sidebar-border flex w-14 shrink-0 flex-col border-r pt-4 md:w-56"
      aria-label="メインナビゲーション"
    >
      <ul role="list" className="flex flex-col gap-1 px-2">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm font-medium transition-colors',
                  'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="sr-only truncate md:not-sr-only">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
