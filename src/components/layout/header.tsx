'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import type { SessionUser } from '@/types/auth';

type HeaderProps = {
  user: SessionUser;
};

export function Header({ user }: HeaderProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } finally {
      // Regardless of API result, clear local state and redirect.
      // The server cookie is cleared by the logout API route.
      // router.refresh() invalidates the App Router client-side cache so
      // stale Server Component data is not served after logout.
      router.refresh();
      router.push('/login');
    }
  }

  return (
    <header className="bg-background border-border flex h-14 shrink-0 items-center justify-between border-b px-4 md:px-6">
      <span className="text-foreground text-sm font-semibold tracking-tight md:text-base">
        営業日報システム
      </span>

      <div className="flex items-center gap-3">
        <span className="text-muted-foreground hidden text-sm md:block">{user.name}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          disabled={isLoggingOut}
          aria-label="ログアウト"
        >
          <LogOut aria-hidden="true" />
          <span className="hidden md:inline">ログアウト</span>
        </Button>
      </div>
    </header>
  );
}
