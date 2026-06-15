import { NextRequest, NextResponse } from 'next/server';

import { requireAuth, withErrorHandler, forbidden } from '@/lib/api';
import { HttpStatus } from '@/lib/api/http-status';
import { paginationQuerySchema } from '@/lib/api/pagination';
import { CreateDailyReportSchema, DailyReportQuerySchema } from '@/lib/schemas/daily-report.schema';
import { createDailyReport, listDailyReports } from '@/services/daily-report.service';

export const GET = withErrorHandler(async (request: NextRequest) => {
  const user = await requireAuth(request);
  if (user.role === 'ADMIN') {
    forbidden('この操作を行う権限がありません');
  }

  const searchParams = Object.fromEntries(new URL(request.url).searchParams.entries());
  const query = DailyReportQuerySchema.parse(searchParams);
  const pagination = paginationQuerySchema.parse(searchParams);

  const result = await listDailyReports(user, query, pagination);

  return NextResponse.json(result);
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const user = await requireAuth(request);
  if (user.role === 'ADMIN') {
    forbidden('この操作を行う権限がありません');
  }

  const body = CreateDailyReportSchema.parse(await request.json());

  const result = await createDailyReport(user.id, body);

  return NextResponse.json(result, { status: HttpStatus.CREATED });
});
