import { NextRequest, NextResponse } from 'next/server';

import { badRequest, requireAuth, withErrorHandler } from '@/lib/api';
import { HttpStatus } from '@/lib/api/http-status';
import { CreateDailyReportSchema } from '@/lib/schemas/daily-report.schema';
import {
  deleteDailyReport,
  getDailyReport,
  updateDailyReport,
} from '@/services/daily-report.service';

function parseReportId(id: string): number {
  const parsed = parseInt(id, 10);
  if (isNaN(parsed)) badRequest('IDは整数で指定してください');
  return parsed;
}

export const GET = withErrorHandler(async (request: NextRequest, context) => {
  const user = await requireAuth(request);
  const { id } = await context!.params;
  const reportId = parseReportId(id);

  const result = await getDailyReport(reportId, user.id, user.role, user.departmentId);
  return NextResponse.json(result);
});

export const PUT = withErrorHandler(async (request: NextRequest, context) => {
  const user = await requireAuth(request);
  const { id } = await context!.params;
  const reportId = parseReportId(id);

  const body = CreateDailyReportSchema.parse(await request.json());
  const result = await updateDailyReport(reportId, user.id, body);
  return NextResponse.json(result);
});

export const DELETE = withErrorHandler(async (request: NextRequest, context) => {
  const user = await requireAuth(request);
  const { id } = await context!.params;
  const reportId = parseReportId(id);

  await deleteDailyReport(reportId, user.id);
  return new NextResponse(null, { status: HttpStatus.NO_CONTENT });
});
