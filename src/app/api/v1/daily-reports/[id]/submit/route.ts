import { NextRequest, NextResponse } from 'next/server';

import { badRequest, requireAuth, withErrorHandler } from '@/lib/api';
import { submitDailyReport } from '@/services/daily-report.service';

export const POST = withErrorHandler(async (request: NextRequest, context) => {
  const user = await requireAuth(request);
  const { id } = await context!.params;
  const reportId = parseInt(id, 10);
  if (isNaN(reportId)) badRequest('IDは整数で指定してください');

  const result = await submitDailyReport(reportId, user.id);
  return NextResponse.json(result);
});
