'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, ChevronUp, Loader2, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface CustomerOption {
  id: number;
  name: string;
}

export interface DailyReportFormProps {
  mode: 'new' | 'edit';
  reportId?: number;
  salespersonName: string;
  customers: CustomerOption[];
  defaultValues?: {
    reportDate: string;
    visitRecords: { customerId: string; visitTime: string; visitContent: string }[];
    problem: string;
    plan: string;
  };
}

// ─── Schema (relaxed: draft-compatible, no required visitRecord fields) ─────────

const visitRecordSchema = z.object({
  customerId: z.string(),
  visitTime: z.string(),
  visitContent: z.string().max(2000, '訪問内容は2000文字以内で入力してください'),
});

const formSchema = z.object({
  reportDate: z
    .string()
    .min(1, '報告日は必須です')
    .regex(/^\d{4}-\d{2}-\d{2}$/, '報告日は YYYY-MM-DD 形式で入力してください'),
  visitRecords: z.array(visitRecordSchema),
  problem: z.string().max(2000, '課題・相談は2000文字以内で入力してください'),
  plan: z.string().max(2000, '翌日の予定は2000文字以内で入力してください'),
});

type FormValues = z.infer<typeof formSchema>;

// ─── Helpers ───────────────────────────────────────────────────────────────────

const textareaClass =
  'border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring ' +
  'aria-invalid:border-destructive flex w-full rounded-lg border px-3 py-2 text-sm shadow-xs transition-colors ' +
  'focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';

function buildPayload(values: FormValues) {
  return {
    reportDate: values.reportDate,
    problem: values.problem || undefined,
    plan: values.plan || undefined,
    visitRecords: values.visitRecords.map((vr, index) => ({
      customerId: vr.customerId ? parseInt(vr.customerId, 10) : undefined,
      visitTime: vr.visitTime || undefined,
      visitContent: vr.visitContent || undefined,
      sortOrder: index,
    })),
  };
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function DailyReportForm({
  mode,
  reportId,
  salespersonName,
  customers,
  defaultValues,
}: DailyReportFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<'draft' | 'submit' | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Tracks the report ID once created in 'new' mode so that submit retries use PUT instead of POST,
  // preventing a 409 conflict when the user retries after a failed submit attempt.
  const savedIdRef = useRef<number | undefined>(reportId);

  const {
    register,
    control,
    getValues,
    trigger,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues ?? {
      reportDate: '',
      visitRecords: [{ customerId: '', visitTime: '', visitContent: '' }],
      problem: '',
      plan: '',
    },
  });

  const { fields, append, remove, move } = useFieldArray({ control, name: 'visitRecords' });

  const watchProblem = useWatch({ control, name: 'problem' });
  const watchPlan = useWatch({ control, name: 'plan' });
  const watchVisitRecords = useWatch({ control, name: 'visitRecords' });

  async function saveDraft(values: FormValues): Promise<{ id: number } | null> {
    const currentId = savedIdRef.current;
    // Fetch carries the session cookie automatically (same-origin); no Bearer header needed.
    const url = currentId ? `/api/v1/daily-reports/${currentId}` : '/api/v1/daily-reports';
    const method = currentId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(values)),
    });

    if (res.ok) {
      const result = (await res.json()) as { id: number };
      savedIdRef.current = result.id;
      return result;
    }

    if (res.status === 409) {
      setError('reportDate', { message: '同じ報告日の日報が既に存在します' });
      return null;
    }

    const body = (await res.json().catch(() => ({}))) as {
      message?: string;
      fieldErrors?: { field: string; message: string }[];
    };

    if (res.status === 400 && body.fieldErrors) {
      for (const fe of body.fieldErrors) {
        if (fe.field === 'reportDate') setError('reportDate', { message: fe.message });
      }
    }
    setFormError(
      body.message ?? 'サーバーエラーが発生しました。しばらくしてから再度お試しください。'
    );
    return null;
  }

  function handleDraftSave() {
    setFormError(null);
    setSaveSuccess(false);
    setPendingAction('draft');

    startTransition(async () => {
      const valid = await trigger(['reportDate']);
      if (!valid) return;

      const wasNew = savedIdRef.current === undefined;
      const result = await saveDraft(getValues());
      if (!result) return;

      if (wasNew) {
        // First save in 'new' mode: redirect to the edit URL so further saves use PUT.
        router.replace(`/reports/${result.id}/edit`);
        return;
      }
      setSaveSuccess(true);
    });
  }

  function handleSubmitClick() {
    setFormError(null);
    setSaveSuccess(false);
    setPendingAction('submit');

    startTransition(async () => {
      const valid = await trigger();
      if (!valid) return;

      const values = getValues();

      if (values.visitRecords.length === 0) {
        setFormError('提出には訪問記録が1件以上必要です');
        return;
      }
      for (let i = 0; i < values.visitRecords.length; i++) {
        const vr = values.visitRecords[i];
        if (!vr.customerId) {
          setError(`visitRecords.${i}.customerId`, { message: '顧客は必須です' });
          return;
        }
        if (!vr.visitContent.trim()) {
          setError(`visitRecords.${i}.visitContent`, { message: '訪問内容は必須です' });
          return;
        }
      }

      const saved = await saveDraft(values);
      if (!saved) return;

      const submitRes = await fetch(`/api/v1/daily-reports/${saved.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (submitRes.ok) {
        router.push(`/reports/${saved.id}`);
        return;
      }

      const body = (await submitRes.json().catch(() => ({}))) as { message?: string };
      setFormError(body.message ?? '提出に失敗しました。しばらくしてから再度お試しください。');
    });
  }

  return (
    <div className="space-y-8">
      {formError && (
        <div
          role="alert"
          className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm"
        >
          {formError}
        </div>
      )}
      {saveSuccess && (
        <div
          role="status"
          className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-400"
        >
          下書きを保存しました
        </div>
      )}

      {/* ヘッダ */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium">
            報告日
            <span className="text-destructive ml-1" aria-hidden="true">
              *
            </span>
          </label>
          <Input
            type="date"
            {...register('reportDate')}
            aria-invalid={!!errors.reportDate}
            disabled={isPending}
          />
          {errors.reportDate && (
            <p className="text-destructive text-xs">{errors.reportDate.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">営業担当</p>
          <p className="flex h-9 items-center text-sm">{salespersonName}</p>
        </div>
      </div>

      {/* 訪問記録 */}
      <section aria-label="訪問記録" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">訪問記録</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ customerId: '', visitTime: '', visitContent: '' })}
            disabled={isPending}
          >
            <Plus />
            行追加
          </Button>
        </div>

        {fields.length === 0 && (
          <p className="text-muted-foreground py-4 text-center text-sm">
            訪問記録がありません。「行追加」ボタンで追加してください。
          </p>
        )}

        {fields.map((field, index) => (
          <div key={field.id} className="rounded-lg border p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-medium">訪問 {index + 1}</span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="上へ移動"
                  onClick={() => move(index, index - 1)}
                  disabled={index === 0 || isPending}
                >
                  <ChevronUp />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="下へ移動"
                  onClick={() => move(index, index + 1)}
                  disabled={index === fields.length - 1 || isPending}
                >
                  <ChevronDown />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="行削除"
                  onClick={() => remove(index)}
                  disabled={isPending}
                  className="text-destructive hover:text-destructive/80"
                >
                  <Trash2 />
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium">顧客</label>
                  <NativeSelect
                    {...register(`visitRecords.${index}.customerId`)}
                    aria-invalid={!!errors.visitRecords?.[index]?.customerId}
                    disabled={isPending}
                  >
                    <option value="">選択してください</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </NativeSelect>
                  {errors.visitRecords?.[index]?.customerId && (
                    <p className="text-destructive text-xs">
                      {errors.visitRecords[index].customerId?.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">訪問時刻</label>
                  <Input
                    type="time"
                    {...register(`visitRecords.${index}.visitTime`)}
                    disabled={isPending}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">訪問内容</label>
                  <span className="text-muted-foreground text-xs">
                    {watchVisitRecords?.[index]?.visitContent?.length ?? 0} / 2000
                  </span>
                </div>
                <textarea
                  {...register(`visitRecords.${index}.visitContent`)}
                  rows={3}
                  maxLength={2000}
                  disabled={isPending}
                  aria-invalid={!!errors.visitRecords?.[index]?.visitContent}
                  className={textareaClass}
                />
                {errors.visitRecords?.[index]?.visitContent && (
                  <p className="text-destructive text-xs">
                    {errors.visitRecords[index].visitContent?.message}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* 所感 */}
      <section aria-label="所感" className="space-y-4">
        <h2 className="font-medium">所感</h2>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">課題・相談（Problem）</label>
            <span className="text-muted-foreground text-xs">
              {watchProblem?.length ?? 0} / 2000
            </span>
          </div>
          <textarea
            {...register('problem')}
            rows={4}
            maxLength={2000}
            disabled={isPending}
            aria-invalid={!!errors.problem}
            className={textareaClass}
          />
          {errors.problem && <p className="text-destructive text-xs">{errors.problem.message}</p>}
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">翌日の予定（Plan）</label>
            <span className="text-muted-foreground text-xs">{watchPlan?.length ?? 0} / 2000</span>
          </div>
          <textarea
            {...register('plan')}
            rows={4}
            maxLength={2000}
            disabled={isPending}
            aria-invalid={!!errors.plan}
            className={textareaClass}
          />
          {errors.plan && <p className="text-destructive text-xs">{errors.plan.message}</p>}
        </div>
      </section>

      {/* ボタン */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => router.push('/reports')}
        >
          キャンセル
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={isPending} onClick={handleDraftSave}>
            {isPending && pendingAction === 'draft' && <Loader2 className="size-4 animate-spin" />}
            下書き保存
          </Button>
          <Button type="button" disabled={isPending} onClick={handleSubmitClick}>
            {isPending && pendingAction === 'submit' && <Loader2 className="size-4 animate-spin" />}
            提出
          </Button>
        </div>
      </div>
    </div>
  );
}
