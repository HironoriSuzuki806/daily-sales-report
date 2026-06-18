'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface DepartmentOption {
  id: number;
  name: string;
}

interface SalespersonFormProps {
  mode: 'new' | 'edit';
  salespersonId?: number;
  defaultValues?: {
    name: string;
    email: string;
    role: 'SALES' | 'MANAGER' | 'ADMIN';
    departmentId: number | null;
    isActive: boolean;
  };
  departments: DepartmentOption[];
}

type FieldErrors = Partial<Record<'name' | 'email' | 'password' | 'role' | 'departmentId', string>>;

const selectClassName =
  'border-input bg-background text-foreground focus-visible:ring-ring flex h-9 w-full rounded-lg border px-3 py-1 text-sm shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';

export function SalespersonForm({
  mode,
  salespersonId,
  defaultValues,
  departments,
}: SalespersonFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const roleId = useId();
  const departmentId = useId();
  const isActiveId = useId();
  const formErrorId = useId();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const name = (formData.get('name') as string).trim();
    const email = (formData.get('email') as string).trim();
    const password = mode === 'new' ? (formData.get('password') as string) : undefined;
    const role = formData.get('role') as string;
    const departmentIdRaw = formData.get('departmentId') as string;
    const isActive = formData.get('isActive') === 'on';

    const errors: FieldErrors = {};

    if (!name) errors.name = '氏名は必須です';
    else if (name.length > 100) errors.name = '氏名は100文字以内で入力してください';

    if (!email) errors.email = 'メールアドレスは必須です';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errors.email = '有効なメールアドレスを入力してください';

    if (mode === 'new') {
      if (!password) errors.password = 'パスワードは必須です';
      else if (password.length > 72) errors.password = 'パスワードは72文字以内で入力してください';
    }

    if (!role) errors.role = '役割は必須です';
    if (!departmentIdRaw) errors.departmentId = '所属部署は必須です';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setFormError(null);

    const payload: Record<string, unknown> = {
      name,
      email,
      role,
      departmentId: parseInt(departmentIdRaw, 10),
      isActive,
    };
    if (mode === 'new') payload.password = password;

    startTransition(async () => {
      try {
        const url =
          mode === 'new' ? '/api/v1/salespersons' : `/api/v1/salespersons/${salespersonId}`;
        const method = mode === 'new' ? 'POST' : 'PUT';

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          router.push('/salespersons');
          router.refresh();
          return;
        }

        const body = (await res.json()) as {
          message?: string;
          fieldErrors?: { field: string; message: string }[];
        };

        if (res.status === 409) {
          setFieldErrors({ email: 'このメールアドレスはすでに使用されています' });
          return;
        }

        if (res.status === 400) {
          if (body.fieldErrors && body.fieldErrors.length > 0) {
            const serverErrors: FieldErrors = {};
            for (const fe of body.fieldErrors) {
              const field = fe.field as keyof FieldErrors;
              if (!serverErrors[field]) serverErrors[field] = fe.message;
            }
            setFieldErrors(serverErrors);
            if (!body.fieldErrors.some((fe) => fe.field) && body.message) {
              setFormError(body.message);
            }
          } else {
            setFormError(body.message ?? '入力値に誤りがあります');
          }
          return;
        }

        setFormError(
          body.message ?? 'サーバーエラーが発生しました。しばらくしてから再度お試しください。'
        );
      } catch (err) {
        console.error('[salesperson-form] network error:', err);
        setFormError('ネットワークエラーが発生しました。接続を確認してください。');
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-6"
      aria-describedby={formError ? formErrorId : undefined}
    >
      {formError && (
        <div
          id={formErrorId}
          role="alert"
          className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm"
        >
          {formError}
        </div>
      )}

      {/* 氏名 */}
      <div className="space-y-1">
        <label htmlFor={nameId} className="text-sm font-medium">
          氏名
          <span className="text-destructive ml-1" aria-hidden="true">
            *
          </span>
        </label>
        <Input
          id={nameId}
          name="name"
          type="text"
          maxLength={100}
          required
          aria-required="true"
          defaultValue={defaultValues?.name ?? ''}
          disabled={isPending}
          aria-invalid={!!fieldErrors.name}
        />
        {fieldErrors.name && <p className="text-destructive text-xs">{fieldErrors.name}</p>}
      </div>

      {/* メールアドレス */}
      <div className="space-y-1">
        <label htmlFor={emailId} className="text-sm font-medium">
          メールアドレス
          <span className="text-destructive ml-1" aria-hidden="true">
            *
          </span>
        </label>
        <Input
          id={emailId}
          name="email"
          type="email"
          maxLength={255}
          required
          aria-required="true"
          defaultValue={defaultValues?.email ?? ''}
          disabled={isPending}
          aria-invalid={!!fieldErrors.email}
          autoComplete="email"
        />
        {fieldErrors.email && <p className="text-destructive text-xs">{fieldErrors.email}</p>}
      </div>

      {/* パスワード（新規登録時のみ） */}
      {mode === 'new' && (
        <div className="space-y-1">
          <label htmlFor={passwordId} className="text-sm font-medium">
            パスワード
            <span className="text-destructive ml-1" aria-hidden="true">
              *
            </span>
          </label>
          <Input
            id={passwordId}
            name="password"
            type="password"
            maxLength={72}
            required
            aria-required="true"
            disabled={isPending}
            aria-invalid={!!fieldErrors.password}
            autoComplete="new-password"
          />
          {fieldErrors.password && (
            <p className="text-destructive text-xs">{fieldErrors.password}</p>
          )}
        </div>
      )}

      {/* 役割 */}
      <div className="space-y-1">
        <label htmlFor={roleId} className="text-sm font-medium">
          役割
          <span className="text-destructive ml-1" aria-hidden="true">
            *
          </span>
        </label>
        <select
          id={roleId}
          name="role"
          defaultValue={defaultValues?.role ?? ''}
          disabled={isPending}
          aria-invalid={!!fieldErrors.role}
          aria-required="true"
          className={selectClassName}
        >
          <option value="">選択してください</option>
          <option value="SALES">営業</option>
          <option value="MANAGER">上長</option>
          <option value="ADMIN">管理者</option>
        </select>
        {fieldErrors.role && <p className="text-destructive text-xs">{fieldErrors.role}</p>}
      </div>

      {/* 所属部署 */}
      <div className="space-y-1">
        <label htmlFor={departmentId} className="text-sm font-medium">
          所属部署
          <span className="text-destructive ml-1" aria-hidden="true">
            *
          </span>
        </label>
        <select
          id={departmentId}
          name="departmentId"
          defaultValue={defaultValues?.departmentId ?? ''}
          disabled={isPending}
          aria-invalid={!!fieldErrors.departmentId}
          aria-required="true"
          className={selectClassName}
        >
          <option value="">選択してください</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.name}
            </option>
          ))}
        </select>
        {fieldErrors.departmentId && (
          <p className="text-destructive text-xs">{fieldErrors.departmentId}</p>
        )}
      </div>

      {/* 有効フラグ */}
      <div className="flex items-center gap-2">
        <input
          id={isActiveId}
          name="isActive"
          type="checkbox"
          defaultChecked={defaultValues?.isActive ?? true}
          disabled={isPending}
          className="size-4 rounded border"
        />
        <label htmlFor={isActiveId} className="text-sm font-medium">
          有効
        </label>
      </div>

      {/* ボタン */}
      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => router.push('/salespersons')}
        >
          キャンセル
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              保存中...
            </>
          ) : (
            '保存'
          )}
        </Button>
      </div>
    </form>
  );
}
