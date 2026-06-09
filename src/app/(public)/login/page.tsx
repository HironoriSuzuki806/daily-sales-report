'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoginSchema } from '@/lib/schemas/auth.schema';

type FieldErrors = Partial<Record<'email' | 'password', string>>;

export default function LoginPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const emailId = useId();
  const passwordId = useId();
  const emailErrorId = useId();
  const passwordErrorId = useId();
  const formErrorId = useId();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const raw = {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
    };

    // Client-side validation
    const result = LoginSchema.safeParse(raw);
    if (!result.success) {
      const errors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof FieldErrors;
        if (!errors[field]) {
          errors[field] = issue.message;
        }
      }
      setFieldErrors(errors);
      setFormError(null);
      return;
    }

    setFieldErrors({});
    setFormError(null);

    startTransition(async () => {
      try {
        const res = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(result.data),
        });

        if (res.ok) {
          router.push('/home');
          router.refresh();
          return;
        }

        if (res.status === 401) {
          setFormError('メールアドレスまたはパスワードが正しくありません');
          return;
        }

        // 400 with fieldErrors from server
        if (res.status === 400) {
          const body = (await res.json()) as {
            fieldErrors?: { field: string; message: string }[];
          };
          if (body.fieldErrors && body.fieldErrors.length > 0) {
            const serverErrors: FieldErrors = {};
            for (const fe of body.fieldErrors) {
              const field = fe.field as keyof FieldErrors;
              if (!serverErrors[field]) {
                serverErrors[field] = fe.message;
              }
            }
            setFieldErrors(serverErrors);
          } else {
            setFormError('入力値に誤りがあります');
          }
          return;
        }

        setFormError('サーバーエラーが発生しました。しばらくしてから再度お試しください。');
      } catch (err) {
        console.error('[login] network error:', err);
        setFormError('ネットワークエラーが発生しました。接続を確認してください。');
      }
    });
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border p-8 shadow-sm">
        <div className="mb-6 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">営業日報システム</h1>
          <p className="text-muted-foreground text-sm">
            メールアドレスとパスワードでログインしてください
          </p>
        </div>

        {formError && (
          <div
            id={formErrorId}
            role="alert"
            className="bg-destructive/10 text-destructive mb-4 rounded-lg px-3 py-2 text-sm"
          >
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="space-y-1">
            <label htmlFor={emailId} className="text-sm font-medium">
              メールアドレス
            </label>
            <Input
              id={emailId}
              name="email"
              type="email"
              autoComplete="email"
              maxLength={255}
              required
              aria-required="true"
              disabled={isPending}
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? emailErrorId : undefined}
            />
            {fieldErrors.email && (
              <p id={emailErrorId} className="text-destructive text-xs">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor={passwordId} className="text-sm font-medium">
              パスワード
            </label>
            <Input
              id={passwordId}
              name="password"
              type="password"
              autoComplete="current-password"
              maxLength={72}
              required
              aria-required="true"
              disabled={isPending}
              aria-invalid={!!fieldErrors.password}
              aria-describedby={fieldErrors.password ? passwordErrorId : undefined}
            />
            {fieldErrors.password && (
              <p id={passwordErrorId} className="text-destructive text-xs">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                ログイン中...
              </>
            ) : (
              'ログイン'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
