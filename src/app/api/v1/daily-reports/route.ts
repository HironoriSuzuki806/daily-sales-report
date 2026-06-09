import { NextRequest, NextResponse } from 'next/server';

import { requireAuth, withErrorHandler } from '@/lib/api';
import { HttpStatus } from '@/lib/api/http-status';
import { CreateDailyReportSchema } from '@/lib/schemas/daily-report.schema';
import { createDailyReport } from '@/services/daily-report.service';

export const POST = withErrorHandler(async (request: NextRequest) => {
  const user = await requireAuth(request);

  const body = CreateDailyReportSchema.parse(await request.json());

  const result = await createDailyReport(user.id, body);

  return NextResponse.json(result, { status: HttpStatus.CREATED });
});
