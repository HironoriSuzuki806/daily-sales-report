import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { ApiError, badRequest, conflict, forbidden, notFound, unauthorized, withErrorHandler } from './handler';
import { HttpStatus } from './http-status';

function makeRequest(url = 'http://localhost/api/v1/test') {
  return new NextRequest(url);
}

describe('withErrorHandler', () => {
  it('正常なハンドラーはそのままレスポンスを返す', async () => {
    const handler = withErrorHandler(async () => NextResponse.json({ ok: true }));
    const res = await handler(makeRequest());
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('ZodError を 400 に変換する', async () => {
    const schema = z.object({ name: z.string().min(1) });
    const handler = withErrorHandler(async () => {
      schema.parse({ name: '' });
      return NextResponse.json({});
    });
    const res = await handler(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(body.fieldErrors).toBeDefined();
    expect(body.fieldErrors[0].field).toBe('name');
  });

  it('ApiError のステータスをそのまま返す', async () => {
    const handler = withErrorHandler(async () => {
      throw new ApiError(HttpStatus.NOT_FOUND, '見つかりません');
    });
    const res = await handler(makeRequest());
    expect(res.status).toBe(HttpStatus.NOT_FOUND);
  });

  it('未知のエラーを 500 に変換する', async () => {
    const handler = withErrorHandler(async () => {
      throw new Error('予期しないエラー');
    });
    const res = await handler(makeRequest());
    expect(res.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});

describe('helper throw functions', () => {
  it('notFound は 404 をスローする', () => {
    expect(() => notFound()).toThrow(ApiError);
    try { notFound(); } catch (e) {
      expect((e as ApiError).status).toBe(HttpStatus.NOT_FOUND);
    }
  });

  it('forbidden は 403 をスローする', () => {
    try { forbidden(); } catch (e) {
      expect((e as ApiError).status).toBe(HttpStatus.FORBIDDEN);
    }
  });

  it('unauthorized は 401 をスローする', () => {
    try { unauthorized(); } catch (e) {
      expect((e as ApiError).status).toBe(HttpStatus.UNAUTHORIZED);
    }
  });

  it('conflict は 409 をスローする', () => {
    try { conflict('重複'); } catch (e) {
      expect((e as ApiError).status).toBe(HttpStatus.CONFLICT);
    }
  });

  it('badRequest は 400 をスローする', () => {
    try { badRequest('不正'); } catch (e) {
      expect((e as ApiError).status).toBe(HttpStatus.BAD_REQUEST);
    }
  });
});
