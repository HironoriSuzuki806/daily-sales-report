import type { NextRequest } from 'next/server';

import { createErrorResponse } from '@/lib/api';
import { AuthError } from '@/lib/auth';
import { logout } from '@/services/auth.service';

const PATH = '/api/v1/auth/logout';

export async function POST(request: NextRequest) {
  try {
    await logout(request);
    return new Response(null, { status: 204 });
  } catch (err) {
    if (err instanceof AuthError) {
      return createErrorResponse(401, err.message, PATH);
    }
    console.error('[POST /api/v1/auth/logout]', err);
    return createErrorResponse(500, 'サーバーエラーが発生しました', PATH);
  }
}
