import { z } from 'zod';

export const DepartmentCreateSchema = z.object({
  name: z.string().min(1, '部署名は必須です').max(100, '部署名は100文字以内で入力してください'),
  parentDepartmentId: z.number().int().positive().optional(),
  managerId: z.number().int().positive().optional(),
  isActive: z.boolean().optional().default(true),
});

export const DepartmentUpdateSchema = z.object({
  name: z.string().min(1, '部署名は必須です').max(100, '部署名は100文字以内で入力してください'),
  parentDepartmentId: z.number().int().positive().optional().nullable(),
  managerId: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const DepartmentQuerySchema = z.object({
  name: z.string().optional(),
  parentDepartmentId: z
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

export type DepartmentCreate = z.infer<typeof DepartmentCreateSchema>;
export type DepartmentUpdate = z.infer<typeof DepartmentUpdateSchema>;
export type DepartmentQuery = z.infer<typeof DepartmentQuerySchema>;
