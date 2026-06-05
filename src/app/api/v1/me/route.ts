import type { NextRequest } from 'next/server';

import { createErrorResponse } from '@/lib/api';
import { AuthError } from '@/lib/auth';
import { getMe } from '@/services/auth.service';

const PATH = '/api/v1/me';

export async function GET(request: NextRequest) {
  try {
    const result = await getMe(request);
    return Response.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      return createErrorResponse(401, err.message, PATH);
    }
    console.error('[GET /api/v1/me]', err);
    return createErrorResponse(500, 'サーバーエラーが発生しました', PATH);
  }
}
