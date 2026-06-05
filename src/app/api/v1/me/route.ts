import { NextRequest, NextResponse } from 'next/server';

import { ApiError, withErrorHandler } from '@/lib/api';
import { HttpStatus } from '@/lib/api/http-status';
import { AuthError } from '@/lib/auth';
import { getMe } from '@/services/auth.service';

export const GET = withErrorHandler(async (request: NextRequest) => {
  try {
    const result = await getMe(request);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, err.message);
    }
    throw err;
  }
});
