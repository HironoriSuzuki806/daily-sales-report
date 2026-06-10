import { z } from 'zod';

const customerPhoneField = z
  .string()
  .max(20, '電話番号は20文字以内で入力してください')
  .regex(/^[\d\-]+$/, '電話番号は数字とハイフンのみ使用できます')
  .optional();

export const CustomerCreateSchema = z.object({
  name: z.string().min(1, '顧客名は必須です').max(100, '顧客名は100文字以内で入力してください'),
  address: z.string().max(255, '住所は255文字以内で入力してください').optional(),
  phone: customerPhoneField,
  salesRepId: z.number().int().positive().optional(),
  isActive: z.boolean().optional().default(true),
});

export const CustomerUpdateSchema = z.object({
  name: z.string().min(1, '顧客名は必須です').max(100, '顧客名は100文字以内で入力してください'),
  address: z.string().max(255, '住所は255文字以内で入力してください').optional(),
  phone: customerPhoneField,
  salesRepId: z.number().int().positive().optional(),
  isActive: z.boolean(),
});

export const CustomerQuerySchema = z.object({
  name: z.string().optional(),
  salesRepId: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : undefined))
    .pipe(z.number().int().positive().optional()),
  isActive: z
    .string()
    .optional()
    .transform((v) => {
      if (v === 'true') return true;
      if (v === 'false') return false;
      return undefined;
    })
    .pipe(z.boolean().optional()),
});

export type CustomerCreate = z.infer<typeof CustomerCreateSchema>;
export type CustomerUpdate = z.infer<typeof CustomerUpdateSchema>;
export type CustomerQuery = z.infer<typeof CustomerQuerySchema>;

// 後方互換: サービス層の引数型として使う共用型
export type CustomerInput = CustomerCreate | CustomerUpdate;
