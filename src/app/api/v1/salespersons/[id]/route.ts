import { NextRequest, NextResponse } from 'next/server';

import { requireAuth, withErrorHandler, forbidden } from '@/lib/api';
import { HttpStatus } from '@/lib/api/http-status';
import { SalespersonInputSchema } from '@/lib/schemas/salesperson.schema';
import {
  getSalesperson,
  updateSalesperson,
  deleteSalesperson,
} from '@/services/salesperson.service';

type RouteContext = { params: Promise<Record<string, string>> };

export const GET = withErrorHandler(async (request: NextRequest, context?: RouteContext) => {
  const user = await requireAuth(request);
  if (user.role !== 'ADMIN') {
    forbidden('この操作を行う権限がありません');
  }

  const { id } = await context!.params;
  const numId = parseInt(id, 10);

  const result = await getSalesperson(numId);

  return NextResponse.json(result);
});

export const PUT = withErrorHandler(async (request: NextRequest, context?: RouteContext) => {
  const user = await requireAuth(request);
  if (user.role !== 'ADMIN') {
    forbidden('この操作を行う権限がありません');
  }

  const { id } = await context!.params;
  const numId = parseInt(id, 10);

  const body = SalespersonInputSchema.parse(await request.json());
  const result = await updateSalesperson(numId, body);

  return NextResponse.json(result);
});

export const DELETE = withErrorHandler(async (request: NextRequest, context?: RouteContext) => {
  const user = await requireAuth(request);
  if (user.role !== 'ADMIN') {
    forbidden('この操作を行う権限がありません');
  }

  const { id } = await context!.params;
  const numId = parseInt(id, 10);

  await deleteSalesperson(numId);

  return new NextResponse(null, { status: HttpStatus.NO_CONTENT });
});
