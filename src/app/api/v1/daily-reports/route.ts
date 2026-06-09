import { NextRequest, NextResponse } from 'next/server';

import { requireAuth, withErrorHandler, forbidden } from '@/lib/api';
import { HttpStatus } from '@/lib/api/http-status';
import { CreateDailyReportSchema } from '@/lib/schemas/daily-report.schema';
import { createDailyReport } from '@/services/daily-report.service';

export const POST = withErrorHandler(async (request: NextRequest) => {
  const user = await requireAuth(request);
  if (user.role === 'ADMIN') {
    forbidden('この操作を行う権限がありません');
  }

  const body = CreateDailyReportSchema.parse(await request.json());

  const result = await createDailyReport(user.id, body);

  return NextResponse.json(result, { status: HttpStatus.CREATED });
});
