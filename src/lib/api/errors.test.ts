import { ZodError, z } from 'zod';
import { describe, expect, it } from 'vitest';
import { createErrorResponse, zodErrorToFieldErrors } from './errors';
import { HttpStatus } from './http-status';

describe('createErrorResponse', () => {
  it('必須フィールドを含むエラーレスポンスを返す', async () => {
    const res = createErrorResponse(HttpStatus.BAD_REQUEST, 'テストエラー', '/api/v1/test');
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.status).toBe(400);
    expect(body.error).toBe('Bad Request');
    expect(body.message).toBe('テストエラー');
    expect(body.path).toBe('/api/v1/test');
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    expect(body.fieldErrors).toBeUndefined();
  });

  it('fieldErrors が空でない場合はレスポンスに含まれる', async () => {
    const res = createErrorResponse(HttpStatus.BAD_REQUEST, 'バリデーションエラー', '/api/v1/test', [
      { field: 'name', message: '必須項目です' },
    ]);
    const body = await res.json();

    expect(body.fieldErrors).toEqual([{ field: 'name', message: '必須項目です' }]);
  });

  it('401 のステータステキストが正しい', async () => {
    const res = createErrorResponse(HttpStatus.UNAUTHORIZED, '認証が必要です', '/api/v1/test');
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('404 のステータステキストが正しい', async () => {
    const res = createErrorResponse(HttpStatus.NOT_FOUND, '見つかりません', '/api/v1/test');
    const body = await res.json();
    expect(body.error).toBe('Not Found');
  });

  it('409 のステータステキストが正しい', async () => {
    const res = createErrorResponse(HttpStatus.CONFLICT, '重複しています', '/api/v1/test');
    const body = await res.json();
    expect(body.error).toBe('Conflict');
  });
});

describe('zodErrorToFieldErrors', () => {
  it('ZodError を FieldError[] に変換する', () => {
    const schema = z.object({ email: z.string().email(), name: z.string().min(1) });
    let zodError: ZodError | null = null;
    try {
      schema.parse({ email: 'invalid', name: '' });
    } catch (e) {
      zodError = e as ZodError;
    }

    const fieldErrors = zodErrorToFieldErrors(zodError!);
    expect(fieldErrors).toHaveLength(2);
    expect(fieldErrors.map((e) => e.field)).toContain('email');
    expect(fieldErrors.map((e) => e.field)).toContain('name');
  });
});
