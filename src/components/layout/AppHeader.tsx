'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

type AppHeaderProps = {
  userName: string;
};

export function AppHeader({ userName }: AppHeaderProps) {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <header className="bg-background flex h-16 items-center justify-between border-b px-6">
      <span className="text-lg font-semibold">営業日報システム</span>
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground text-sm">{userName}</span>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut />
          ログアウト
        </Button>
      </div>
    </header>
  );
}
