import { redirect } from 'next/navigation';

import { getSessionUser } from '@/lib/session';

export default async function Home() {
  const session = await getSessionUser();
  if (!session) {
    redirect('/login');
  }
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-bold tracking-tight">営業日報システム</h1>
      <p className="text-muted-foreground">
        ようこそ、{session.name} さん — ホーム画面は準備中です（Issue #20）
      </p>
    </div>
  );
}
