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

interface DepartmentFormProps {
  mode: 'new' | 'edit';
  departmentId?: number;
  defaultValues?: {
    name: string;
    parentDepartmentId: number | null;
    managerId: number | null;
    isActive: boolean;
  };
  departments: DepartmentOption[];
  salespersons: DepartmentOption[];
}

type FieldErrors = Partial<Record<'name' | 'parentDepartmentId' | 'managerId', string>>;

export function DepartmentForm({
  mode,
  departmentId,
  defaultValues,
  departments,
  salespersons,
}: DepartmentFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const nameId = useId();
  const parentId = useId();
  const managerId = useId();
  const isActiveId = useId();
  const formErrorId = useId();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const name = (formData.get('name') as string).trim();
    const parentDepartmentIdRaw = formData.get('parentDepartmentId') as string;
    const managerIdRaw = formData.get('managerId') as string;
    const isActive = formData.get('isActive') === 'on';

    if (!name) {
      setFieldErrors({ name: '部署名は必須です' });
      return;
    }
    if (name.length > 100) {
      setFieldErrors({ name: '部署名は100文字以内で入力してください' });
      return;
    }

    setFieldErrors({});
    setFormError(null);

    const payload: Record<string, unknown> = {
      name,
      parentDepartmentId: parentDepartmentIdRaw ? parseInt(parentDepartmentIdRaw, 10) : null,
      managerId: managerIdRaw ? parseInt(managerIdRaw, 10) : null,
      isActive,
    };

    // Remove null fields on create (optional fields)
    if (mode === 'new') {
      if (payload.parentDepartmentId === null) delete payload.parentDepartmentId;
      if (payload.managerId === null) delete payload.managerId;
    }

    startTransition(async () => {
      try {
        const url = mode === 'new' ? '/api/v1/departments' : `/api/v1/departments/${departmentId}`;
        const method = mode === 'new' ? 'POST' : 'PUT';

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          router.push('/departments');
          router.refresh();
          return;
        }

        const body = (await res.json()) as {
          message?: string;
          fieldErrors?: { field: string; message: string }[];
        };

        if (res.status === 400) {
          if (body.fieldErrors && body.fieldErrors.length > 0) {
            const serverErrors: FieldErrors = {};
            for (const fe of body.fieldErrors) {
              const field = fe.field as keyof FieldErrors;
              if (!serverErrors[field]) {
                serverErrors[field] = fe.message;
              }
            }
            setFieldErrors(serverErrors);
            // Also show non-field error as form-level if it's about circular reference
            const hasCircular = body.fieldErrors.some(
              (fe) => fe.message.includes('循環') || fe.message.includes('自部署')
            );
            if (!hasCircular && body.message) {
              setFormError(body.message);
            }
          } else if (body.message) {
            // Circular reference or self-reference check errors come as message, not fieldErrors
            if (
              body.message.includes('循環') ||
              body.message.includes('自部署') ||
              body.message.includes('上位部署')
            ) {
              setFieldErrors({ parentDepartmentId: body.message });
            } else if (body.message.includes('部署長')) {
              setFieldErrors({ managerId: body.message });
            } else {
              setFormError(body.message);
            }
          } else {
            setFormError('入力値に誤りがあります');
          }
          return;
        }

        setFormError(
          body.message ?? 'サーバーエラーが発生しました。しばらくしてから再度お試しください。'
        );
      } catch (err) {
        console.error('[department-form] network error:', err);
        setFormError('ネットワークエラーが発生しました。接続を確認してください。');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {formError && (
        <div
          id={formErrorId}
          role="alert"
          className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm"
        >
          {formError}
        </div>
      )}

      {/* 部署名 */}
      <div className="space-y-1">
        <label htmlFor={nameId} className="text-sm font-medium">
          部署名
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

      {/* 上位部署 */}
      <div className="space-y-1">
        <label htmlFor={parentId} className="text-sm font-medium">
          上位部署
        </label>
        <select
          id={parentId}
          name="parentDepartmentId"
          defaultValue={defaultValues?.parentDepartmentId ?? ''}
          disabled={isPending}
          aria-invalid={!!fieldErrors.parentDepartmentId}
          className="border-input bg-background text-foreground focus-visible:ring-ring flex h-9 w-full rounded-lg border px-3 py-1 text-sm shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">（なし）</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.name}
            </option>
          ))}
        </select>
        {fieldErrors.parentDepartmentId && (
          <p className="text-destructive text-xs">{fieldErrors.parentDepartmentId}</p>
        )}
        <p className="text-muted-foreground text-xs">自部署および循環する設定は保存できません</p>
      </div>

      {/* 部署長 */}
      <div className="space-y-1">
        <label htmlFor={managerId} className="text-sm font-medium">
          部署長
        </label>
        <select
          id={managerId}
          name="managerId"
          defaultValue={defaultValues?.managerId ?? ''}
          disabled={isPending}
          aria-invalid={!!fieldErrors.managerId}
          className="border-input bg-background text-foreground focus-visible:ring-ring flex h-9 w-full rounded-lg border px-3 py-1 text-sm shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">（なし）</option>
          {salespersons.map((sp) => (
            <option key={sp.id} value={sp.id}>
              {sp.name}
            </option>
          ))}
        </select>
        {fieldErrors.managerId && (
          <p className="text-destructive text-xs">{fieldErrors.managerId}</p>
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
          onClick={() => router.push('/departments')}
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
