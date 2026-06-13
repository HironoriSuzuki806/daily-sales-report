import { NextRequest, NextResponse } from 'next/server';

import { requireAuth, withErrorHandler, forbidden, badRequest } from '@/lib/api';
import { HttpStatus } from '@/lib/api/http-status';
import { DepartmentUpdateSchema } from '@/lib/schemas/department.schema';
import { getDepartment, updateDepartment, deleteDepartment } from '@/services/department.service';

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

  const result = await getDepartment(numId);
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

  const body = DepartmentUpdateSchema.parse(await request.json());
  const result = await updateDepartment(numId, body);

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

  await deleteDepartment(numId);

  return new NextResponse(null, { status: HttpStatus.NO_CONTENT });
});
