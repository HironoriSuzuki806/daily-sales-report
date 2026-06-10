import { NextRequest, NextResponse } from 'next/server';

import { requireAuth, withErrorHandler, forbidden, badRequest } from '@/lib/api';
import { HttpStatus } from '@/lib/api/http-status';
import { SalespersonUpdateSchema } from '@/lib/schemas/salesperson.schema';
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
  if (isNaN(numId)) {
    badRequest('ID は正の整数を指定してください');
  }

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
  if (isNaN(numId)) {
    badRequest('ID は正の整数を指定してください');
  }

  const body = SalespersonUpdateSchema.parse(await request.json());
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
  if (isNaN(numId)) {
    badRequest('ID は正の整数を指定してください');
  }

  await deleteSalesperson(numId);

  return new NextResponse(null, { status: HttpStatus.NO_CONTENT });
});
