import { z } from 'zod';

export const DepartmentInputSchema = z.object({
  name: z.string().min(1, '部署名は必須です').max(100, '部署名は100文字以内で入力してください'),
  parentDepartmentId: z
    .number()
    .int()
    .positive('上位部署は正の整数を指定してください')
    .nullable()
    .optional(),
  managerId: z.number().int().positive('部署長は正の整数を指定してください').nullable().optional(),
  isActive: z.boolean().optional().default(true),
});

export const DepartmentQuerySchema = z.object({
  name: z.string().optional(),
  parentDepartmentId: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : undefined))
    .pipe(z.number().int().positive().optional()),
  isActive: z
    .enum(['true', 'false'], {
      error: 'isActive は true または false を指定してください',
    })
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true'))
    .pipe(z.boolean().optional()),
});

// PUT は API仕様書 §7.3 に基づく全フィールド送信（フルリプレイス）を前提とするため
// name は必須のまま。isActive のみ optional に変更（POST 時の default: true を外す）。
export const DepartmentUpdateSchema = DepartmentInputSchema.extend({
  isActive: z.boolean().optional(),
});

export type DepartmentInput = z.infer<typeof DepartmentInputSchema>;
export type DepartmentUpdate = z.infer<typeof DepartmentUpdateSchema>;
export type DepartmentQuery = z.infer<typeof DepartmentQuerySchema>;
