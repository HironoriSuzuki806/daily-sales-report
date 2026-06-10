import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { createErrorResponse, zodErrorToFieldErrors } from './errors';
import { HttpStatus } from './http-status';

type RouteContext = { params: Promise<Record<string, string>> };

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Route Handler を共通のエラーハンドリングでラップする。
 * - ZodError → 400 + fieldErrors
 * - ApiError → 指定ステータス
 * - その他 Error → 500
 */
export function withErrorHandler(
  handler: (request: NextRequest, context?: RouteContext) => Promise<NextResponse>,
) {
  return async (request: NextRequest, context?: RouteContext): Promise<NextResponse> => {
    const path = new URL(request.url).pathname;
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof ZodError) {
        return createErrorResponse(
          HttpStatus.BAD_REQUEST,
          '入力値に誤りがあります',
          path,
          zodErrorToFieldErrors(error),
        );
      }
      if (error instanceof ApiError) {
        return createErrorResponse(error.status, error.message, path);
      }
      console.error('[API Error]', error);
      return createErrorResponse(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'サーバー内部エラーが発生しました',
        path,
      );
    }
  };
}

export function notFound(message = 'リソースが見つかりません'): never {
  throw new ApiError(HttpStatus.NOT_FOUND, message);
}

export function forbidden(message = 'この操作を行う権限がありません'): never {
  throw new ApiError(HttpStatus.FORBIDDEN, message);
}

export function unauthorized(message = '認証が必要です'): never {
  throw new ApiError(HttpStatus.UNAUTHORIZED, message);
}

export function conflict(message: string): never {
  throw new ApiError(HttpStatus.CONFLICT, message);
}

export function badRequest(message: string): never {
  throw new ApiError(HttpStatus.BAD_REQUEST, message);
}
