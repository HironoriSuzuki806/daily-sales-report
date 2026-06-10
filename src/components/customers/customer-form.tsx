'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, useTransition } from 'react';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// ─── types ────────────────────────────────────────────────────────────────────

export type SalespersonOption = {
  id: number;
  name: string;
};

export type CustomerFormValues = {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  salesRep: { id: number; name: string } | null;
  isActive: boolean;
};

type CustomerFormProps = {
  /** 編集時は既存の顧客情報を渡す。新規時は undefined。 */
  customer?: CustomerFormValues;
};

type FieldName = 'name' | 'address' | 'phone' | 'salesRepId';
type FieldErrors = Partial<Record<FieldName, string>>;

// ─── client-side validation schema (SCR-202) ─────────────────────────────────

export const CustomerFormSchema = z.object({
  name: z.string().min(1, '顧客名は必須です').max(100, '顧客名は100文字以内で入力してください'),
  address: z.string().max(255, '住所は255文字以内で入力してください'),
  phone: z
    .string()
    .max(20, '電話番号は20文字以内で入力してください')
    .regex(/^[\d-]*$/, '電話番号は数字とハイフンのみ使用できます'),
});

/** API 送信用ペイロードを組み立てる（空文字の任意項目は送らない） */
export function buildCustomerPayload(input: {
  name: string;
  address: string;
  phone: string;
  salesRepId: string;
  isActive: boolean;
}): {
  name: string;
  address?: string;
  phone?: string;
  salesRepId?: number;
  isActive: boolean;
} {
  return {
    name: input.name,
    ...(input.address !== '' ? { address: input.address } : {}),
    ...(input.phone !== '' ? { phone: input.phone } : {}),
    ...(input.salesRepId !== '' ? { salesRepId: Number(input.salesRepId) } : {}),
    isActive: input.isActive,
  };
}

// ─── component ────────────────────────────────────────────────────────────────

export function CustomerForm({ customer }: CustomerFormProps) {
  const router = useRouter();
  const isEdit = customer !== undefined;

  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [salespersons, setSalespersons] = useState<SalespersonOption[]>([]);

  const nameId = useId();
  const addressId = useId();
  const phoneId = useId();
  const salesRepId = useId();
  const isActiveId = useId();
  const nameErrorId = useId();
  const addressErrorId = useId();
  const phoneErrorId = useId();
  const salesRepErrorId = useId();

  // 担当営業プルダウンの選択肢を取得（GET /api/v1/salespersons）
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch('/api/v1/salespersons?isActive=true&size=100', {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const body = (await res.json()) as { content: SalespersonOption[] };
        setSalespersons(body.content.map((s) => ({ id: s.id, name: s.name })));
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          console.error('[customer-form] failed to load salespersons:', err);
        }
      }
    })();
    return () => controller.abort();
  }, []);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const raw = {
      name: (formData.get('name') as string).trim(),
      address: (formData.get('address') as string).trim(),
      phone: (formData.get('phone') as string).trim(),
      salesRepId: formData.get('salesRepId') as string,
      isActive: formData.get('isActive') === 'on',
    };

    // クライアント側バリデーション
    const result = CustomerFormSchema.safeParse(raw);
    if (!result.success) {
      const errors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as FieldName;
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
        const res = await fetch(isEdit ? `/api/v1/customers/${customer.id}` : '/api/v1/customers', {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildCustomerPayload(raw)),
        });

        if (res.ok) {
          router.push('/customers');
          router.refresh();
          return;
        }

        if (res.status === 400) {
          const body = (await res.json()) as {
            message?: string;
            fieldErrors?: { field: string; message: string }[];
          };
          if (body.fieldErrors && body.fieldErrors.length > 0) {
            const serverErrors: FieldErrors = {};
            for (const fe of body.fieldErrors) {
              const field = fe.field as FieldName;
              if (!serverErrors[field]) {
                serverErrors[field] = fe.message;
              }
            }
            setFieldErrors(serverErrors);
          } else {
            setFormError(body.message ?? '入力値に誤りがあります');
          }
          return;
        }

        if (res.status === 403) {
          setFormError('この操作を行う権限がありません');
          return;
        }

        if (res.status === 404) {
          setFormError('顧客が見つかりません');
          return;
        }

        setFormError('サーバーエラーが発生しました。しばらくしてから再度お試しください。');
      } catch (err) {
        console.error('[customer-form] network error:', err);
        setFormError('ネットワークエラーが発生しました。接続を確認してください。');
      }
    });
  }

  function handleCancel() {
    router.push('/customers');
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-xl space-y-4">
      {formError && (
        <div
          role="alert"
          className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm"
        >
          {formError}
        </div>
      )}

      <div className="space-y-1">
        <label htmlFor={nameId} className="text-sm font-medium">
          顧客名 <span className="text-destructive">*</span>
        </label>
        <Input
          id={nameId}
          name="name"
          type="text"
          maxLength={100}
          required
          aria-required="true"
          defaultValue={customer?.name ?? ''}
          disabled={isPending}
          aria-invalid={!!fieldErrors.name}
          aria-describedby={fieldErrors.name ? nameErrorId : undefined}
        />
        {fieldErrors.name && (
          <p id={nameErrorId} className="text-destructive text-xs">
            {fieldErrors.name}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor={addressId} className="text-sm font-medium">
          住所
        </label>
        <Input
          id={addressId}
          name="address"
          type="text"
          maxLength={255}
          defaultValue={customer?.address ?? ''}
          disabled={isPending}
          aria-invalid={!!fieldErrors.address}
          aria-describedby={fieldErrors.address ? addressErrorId : undefined}
        />
        {fieldErrors.address && (
          <p id={addressErrorId} className="text-destructive text-xs">
            {fieldErrors.address}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor={phoneId} className="text-sm font-medium">
          電話番号
        </label>
        <Input
          id={phoneId}
          name="phone"
          type="tel"
          maxLength={20}
          placeholder="03-1234-5678"
          defaultValue={customer?.phone ?? ''}
          disabled={isPending}
          aria-invalid={!!fieldErrors.phone}
          aria-describedby={fieldErrors.phone ? phoneErrorId : undefined}
        />
        {fieldErrors.phone && (
          <p id={phoneErrorId} className="text-destructive text-xs">
            {fieldErrors.phone}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor={salesRepId} className="text-sm font-medium">
          担当営業
        </label>
        <select
          id={salesRepId}
          name="salesRepId"
          defaultValue={customer?.salesRep ? String(customer.salesRep.id) : ''}
          disabled={isPending}
          aria-invalid={!!fieldErrors.salesRepId}
          aria-describedby={fieldErrors.salesRepId ? salesRepErrorId : undefined}
          className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm shadow-xs focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">（未選択）</option>
          {salespersons.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.name}
            </option>
          ))}
        </select>
        {fieldErrors.salesRepId && (
          <p id={salesRepErrorId} className="text-destructive text-xs">
            {fieldErrors.salesRepId}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          id={isActiveId}
          name="isActive"
          type="checkbox"
          defaultChecked={customer?.isActive ?? true}
          disabled={isPending}
          className="border-input size-4 rounded border"
        />
        <label htmlFor={isActiveId} className="text-sm font-medium">
          有効
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={handleCancel} disabled={isPending}>
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
