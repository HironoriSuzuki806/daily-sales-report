import { z } from 'zod';

export const VisitRecordInputSchema = z.object({
  customerId: z.number().int().positive().optional(),
  visitTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, '訪問時刻は HH:mm 形式（00:00〜23:59）で入力してください')
    .optional(),
  visitContent: z.string().max(2000, '訪問内容は2000文字以内で入力してください').optional(),
  sortOrder: z.number().int().min(0),
});

export const CreateDailyReportSchema = z.object({
  reportDate: z
    .string()
    .min(1, '報告日は必須です')
    .regex(/^\d{4}-\d{2}-\d{2}$/, '報告日は YYYY-MM-DD 形式で入力してください')
    .refine((v) => {
      const [y, m, d] = v.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
    }, '有効な日付を入力してください'),
  problem: z.string().max(2000, '課題・相談は2000文字以内で入力してください').optional(),
  plan: z.string().max(2000, '翌日の予定は2000文字以内で入力してください').optional(),
  visitRecords: z.array(VisitRecordInputSchema).default([]),
});

export type CreateDailyReportInput = z.infer<typeof CreateDailyReportSchema>;
export type VisitRecordInput = z.infer<typeof VisitRecordInputSchema>;
