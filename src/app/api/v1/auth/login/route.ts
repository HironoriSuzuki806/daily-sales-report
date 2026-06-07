import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { ApiError, withErrorHandler } from '@/lib/api';
import { HttpStatus } from '@/lib/api/http-status';
import { AuthError } from '@/lib/auth';
import { setSessionCookie } from '@/lib/session';
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

export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = LoginSchema.parse(await request.json());

  try {
    const result = await login(body.email, body.password);
    // Persist the token in an HTTP-only cookie so Server Components and the
    // auth layout can read the session without client-side JS.
    await setSessionCookie(result.accessToken);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, err.message);
    }
    throw err;
  }
});
