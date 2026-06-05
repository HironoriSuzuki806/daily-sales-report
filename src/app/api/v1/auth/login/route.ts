import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { createErrorResponse } from '@/lib/api';
import { AuthError } from '@/lib/auth';
import { login } from '@/services/auth.service';

const LoginSchema = z.object({
  email: z
    .string()
    .min(1, 'メールアドレスは必須です')
    .email('メールアドレスの形式が正しくありません')
    .max(255, 'メールアドレスは255文字以内で入力してください'),
  password: z
    .string()
    .min(1, 'パスワードは必須です')
    .max(72, 'パスワードは72文字以内で入力してください'),
});

const PATH = '/api/v1/auth/login';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse(400, 'リクエストボディが不正です', PATH);
  }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.issues.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return createErrorResponse(400, '入力値に誤りがあります', PATH, fieldErrors);
  }

  const { email, password } = parsed.data;

  try {
    const result = await login(email, password);
    return Response.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      return createErrorResponse(401, err.message, PATH);
    }
    console.error('[POST /api/v1/auth/login]', err);
    return createErrorResponse(500, 'サーバーエラーが発生しました', PATH);
  }
}
