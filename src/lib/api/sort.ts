import { badRequest } from '@/lib/api';

export function parseSortParam<T extends string>(
  sort: string | undefined,
  allowedFields: readonly T[]
): Record<T, 'asc' | 'desc'> | undefined {
  if (sort === undefined) return undefined;

  const parts = sort.split(',');
  if (parts.length !== 2) {
    badRequest(`sort パラメータの形式が不正です。"フィールド,asc|desc" の形式で指定してください`);
  }

  const [field, direction] = parts;

  if (direction !== 'asc' && direction !== 'desc') {
    badRequest(`sort の方向は "asc" または "desc" を指定してください`);
  }

  if (!(allowedFields as readonly string[]).includes(field)) {
    badRequest(
      `sort フィールドに "${field}" は指定できません。指定可能: ${allowedFields.join(', ')}`
    );
  }

  return { [field]: direction } as Record<T, 'asc' | 'desc'>;
}
