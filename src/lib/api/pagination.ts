import { z } from 'zod';

export const paginationQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default('0')
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(0, 'page は 0 以上の整数を指定してください')),
  size: z
    .string()
    .optional()
    .default('20')
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(1).max(100, 'size は 1〜100 の範囲で指定してください')),
  sort: z.string().optional(),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export function createPageResponse<T>(
  content: T[],
  totalElements: number,
  query: PaginationQuery,
): PageResponse<T> {
  return {
    content,
    page: query.page,
    size: query.size,
    totalElements,
    totalPages: Math.ceil(totalElements / query.size),
  };
}
