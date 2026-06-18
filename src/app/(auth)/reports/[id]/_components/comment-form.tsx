'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';

interface CommentFormProps {
  reportId: number;
}

export function CommentForm({ reportId }: CommentFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const textareaId = useId();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();

    if (!trimmed) {
      setError('コメント本文を入力してください');
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/daily-reports/${reportId}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: trimmed }),
        });

        if (res.ok) {
          setContent('');
          router.refresh();
          return;
        }

        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(
          body.message ?? 'コメントの投稿に失敗しました。しばらくしてから再度お試しください。'
        );
      } catch {
        setError('ネットワークエラーが発生しました。接続を確認してください。');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor={textareaId} className="text-sm font-medium">
          コメントを投稿
        </label>
        <span className="text-muted-foreground text-xs">{content.length} / 1000</span>
      </div>
      <textarea
        id={textareaId}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={1000}
        rows={3}
        disabled={isPending}
        aria-invalid={!!error}
        placeholder="コメントを入力してください"
        className={
          'border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring ' +
          'aria-invalid:border-destructive flex w-full rounded-lg border px-3 py-2 text-sm shadow-xs transition-colors ' +
          'focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'
        }
      />
      {error && <p className="text-destructive text-xs">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          投稿
        </Button>
      </div>
    </form>
  );
}
