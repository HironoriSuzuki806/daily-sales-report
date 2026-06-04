import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-3xl font-bold tracking-tight">営業日報システム</h1>
      <p className="text-muted-foreground">セットアップ完了 — shadcn/ui Button の動作確認</p>
      <div className="flex gap-3">
        <Button>ログイン</Button>
        <Button variant="outline">キャンセル</Button>
        <Button variant="destructive">削除</Button>
      </div>
    </div>
  );
}
