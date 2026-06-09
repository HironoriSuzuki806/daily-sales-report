'use client';

import { AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

type HomeErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function HomeError({ error, reset }: HomeErrorProps) {
  return (
    <div className="flex items-start justify-center pt-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertCircle className="size-5" aria-hidden="true" />
            ホームの読み込みに失敗しました
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            データの取得中にエラーが発生しました。しばらく待ってから再試行してください。
          </p>
          {error.digest && (
            <p className="text-muted-foreground mt-2 font-mono text-xs">エラーID: {error.digest}</p>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={reset}>再試行</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
