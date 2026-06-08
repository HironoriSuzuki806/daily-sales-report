import { NextRequest, NextResponse } from 'next/server';

import { ApiError, withErrorHandler } from '@/lib/api';
import { HttpStatus } from '@/lib/api/http-status';
import { AuthError } from '@/lib/auth';
import { LoginSchema } from '@/lib/schemas/auth.schema';
import { setSessionCookie } from '@/lib/session';
import { login } from '@/services/auth.service';

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
