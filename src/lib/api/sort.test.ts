// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { parseSortParam } from './sort';

const SALESPERSON_FIELDS = ['id', 'name', 'email', 'createdAt', 'updatedAt'] as const;
const CUSTOMER_FIELDS = ['id', 'name', 'createdAt', 'updatedAt'] as const;
const DEPARTMENT_FIELDS = ['id', 'name', 'createdAt', 'updatedAt'] as const;
const DAILY_REPORT_FIELDS = ['reportDate', 'createdAt', 'updatedAt'] as const;

describe('parseSortParam', () => {
  it('sort が undefined のとき undefined を返す', () => {
    expect(parseSortParam(undefined, SALESPERSON_FIELDS)).toBeUndefined();
  });

  it('"name,asc" → { name: "asc" }', () => {
    expect(parseSortParam('name,asc', SALESPERSON_FIELDS)).toEqual({ name: 'asc' });
  });

  it('"name,desc" → { name: "desc" }', () => {
    expect(parseSortParam('name,desc', SALESPERSON_FIELDS)).toEqual({ name: 'desc' });
  });

  it('"reportDate,desc" → { reportDate: "desc" }', () => {
    expect(parseSortParam('reportDate,desc', DAILY_REPORT_FIELDS)).toEqual({
      reportDate: 'desc',
    });
  });

  it('"createdAt,asc" は複数リソースで有効', () => {
    expect(parseSortParam('createdAt,asc', CUSTOMER_FIELDS)).toEqual({ createdAt: 'asc' });
    expect(parseSortParam('createdAt,asc', DEPARTMENT_FIELDS)).toEqual({ createdAt: 'asc' });
  });

  it('不正な方向（asc/desc 以外）→ 400 ApiError', async () => {
    const { ApiError } = await import('@/lib/api');
    expect(() => parseSortParam('name,invalid', SALESPERSON_FIELDS)).toThrow(ApiError);
  });

  it('フィールドのみでカンマなし → 400 ApiError', async () => {
    const { ApiError } = await import('@/lib/api');
    expect(() => parseSortParam('name', SALESPERSON_FIELDS)).toThrow(ApiError);
  });

  it('許可されていないフィールド → 400 ApiError', async () => {
    const { ApiError } = await import('@/lib/api');
    expect(() => parseSortParam('password,asc', SALESPERSON_FIELDS)).toThrow(ApiError);
  });

  it('空文字 → 400 ApiError', async () => {
    const { ApiError } = await import('@/lib/api');
    expect(() => parseSortParam('', SALESPERSON_FIELDS)).toThrow(ApiError);
  });

  it('フィールドが3つ以上 → 400 ApiError', async () => {
    const { ApiError } = await import('@/lib/api');
    expect(() => parseSortParam('name,asc,extra', SALESPERSON_FIELDS)).toThrow(ApiError);
  });

  it('"email,asc" は salesperson には有効だが customer には無効', async () => {
    const { ApiError } = await import('@/lib/api');
    expect(parseSortParam('email,asc', SALESPERSON_FIELDS)).toEqual({ email: 'asc' });
    expect(() => parseSortParam('email,asc', CUSTOMER_FIELDS)).toThrow(ApiError);
  });
});
