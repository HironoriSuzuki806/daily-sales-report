import { describe, expect, it } from 'vitest';
import { createPageResponse, paginationQuerySchema } from './pagination';

describe('paginationQuerySchema', () => {
  it('デフォルト値を適用する', () => {
    const result = paginationQuerySchema.parse({});
    expect(result.page).toBe(0);
    expect(result.size).toBe(20);
    expect(result.sort).toBeUndefined();
  });

  it('文字列の数値を変換する', () => {
    const result = paginationQuerySchema.parse({ page: '2', size: '50', sort: 'reportDate,desc' });
    expect(result.page).toBe(2);
    expect(result.size).toBe(50);
    expect(result.sort).toBe('reportDate,desc');
  });

  it('page が負の値ならエラー', () => {
    expect(() => paginationQuerySchema.parse({ page: '-1' })).toThrow();
  });

  it('size が 101 ならエラー', () => {
    expect(() => paginationQuerySchema.parse({ size: '101' })).toThrow();
  });

  it('size が 0 ならエラー', () => {
    expect(() => paginationQuerySchema.parse({ size: '0' })).toThrow();
  });

  it('size が 100 なら通過する', () => {
    const result = paginationQuerySchema.parse({ size: '100' });
    expect(result.size).toBe(100);
  });

  it('数値に変換できない文字列はエラー', () => {
    expect(() => paginationQuerySchema.parse({ page: 'abc' })).toThrow();
  });
});

describe('createPageResponse', () => {
  it('正しいページレスポンスを返す', () => {
    const query = { page: 0, size: 20, sort: undefined };
    const content = [{ id: 1 }, { id: 2 }];
    const response = createPageResponse(content, 42, query);

    expect(response.content).toEqual(content);
    expect(response.page).toBe(0);
    expect(response.size).toBe(20);
    expect(response.totalElements).toBe(42);
    expect(response.totalPages).toBe(3);
  });

  it('totalElements が size の倍数のとき totalPages が正確', () => {
    const query = { page: 1, size: 10, sort: undefined };
    const response = createPageResponse([], 30, query);
    expect(response.totalPages).toBe(3);
  });

  it('コンテンツが空でも動作する', () => {
    const query = { page: 0, size: 20, sort: undefined };
    const response = createPageResponse([], 0, query);
    expect(response.totalPages).toBe(0);
    expect(response.totalElements).toBe(0);
  });
});
