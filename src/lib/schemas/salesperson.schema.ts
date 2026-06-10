import { z } from 'zod';

export const SalespersonInputSchema = z.object({
  name: z.string().min(1, '氏名は必須です').max(100, '氏名は100文字以内で入力してください'),
  email: z
    .string()
    .min(1, 'メールアドレスは必須です')
    .email('有効なメールアドレスを入力してください')
    .max(255, 'メールアドレスは255文字以内で入力してください'),
  password: z
    .string()
    .min(1, 'パスワードは必須です')
    .max(72, 'パスワードは72文字以内で入力してください'),
  role: z.enum(['SALES', 'MANAGER', 'ADMIN'], {
    error: 'role は SALES / MANAGER / ADMIN のいずれかを指定してください',
  }),
  departmentId: z
    .number({ error: '所属部署は必須です' })
    .int()
    .positive('所属部署は正の整数を指定してください'),
  isActive: z.boolean().optional().default(true),
});

export const SalespersonQuerySchema = z.object({
  name: z.string().optional(),
  departmentId: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : undefined))
    .pipe(z.number().int().positive().optional()),
  role: z.enum(['SALES', 'MANAGER', 'ADMIN']).optional(),
  isActive: z
    .enum(['true', 'false'], {
      error: 'isActive は true または false を指定してください',
    })
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      return v === 'true';
    }),
});

export const SalespersonUpdateSchema = SalespersonInputSchema.omit({ password: true }).extend({
  isActive: z.boolean().optional(),
});

export type SalespersonInput = z.infer<typeof SalespersonInputSchema>;
export type SalespersonUpdate = z.infer<typeof SalespersonUpdateSchema>;
export type SalespersonQuery = z.infer<typeof SalespersonQuerySchema>;
