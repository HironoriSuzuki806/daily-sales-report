import { NextRequest, NextResponse } from 'next/server';

import { withErrorHandler } from '@/lib/api';
import { logout } from '@/services/auth.service';

export const POST = withErrorHandler(async (request: NextRequest) => {
  await logout(request);
  return new NextResponse(null, { status: 204 });
});
