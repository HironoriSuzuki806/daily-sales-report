import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { forbidden, paginationQuerySchema, requireAuth, withErrorHandler } from '@/lib/api';
import { HttpStatus } from '@/lib/api/http-status';
import { CreateDailyReportSchema } from '@/lib/schemas/daily-report.schema';
import { createDailyReport, listDailyReports } from '@/services/daily-report.service';

const listFilterSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  salespersonId: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : undefined)),
  status: z.enum(['DRAFT', 'SUBMITTED']).optional(),
});

export const GET = withErrorHandler(async (request: NextRequest) => {
  const user = await requireAuth(request);

  const searchParams = Object.fromEntries(new URL(request.url).searchParams.entries());
  const filters = listFilterSchema.parse(searchParams);
  const pagination = paginationQuerySchema.parse(searchParams);

  const result = await listDailyReports(user.id, user.role, user.departmentId, filters, pagination);

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
