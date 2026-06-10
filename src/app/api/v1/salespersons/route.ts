import { NextRequest, NextResponse } from 'next/server';

import { requireAuth, withErrorHandler, forbidden } from '@/lib/api';
import { HttpStatus } from '@/lib/api/http-status';
import { paginationQuerySchema } from '@/lib/api/pagination';
import { SalespersonInputSchema, SalespersonQuerySchema } from '@/lib/schemas/salesperson.schema';
import { listSalespersons, createSalesperson } from '@/services/salesperson.service';

export const GET = withErrorHandler(async (request: NextRequest) => {
  await requireAuth(request);

  const searchParams = Object.fromEntries(new URL(request.url).searchParams.entries());
  const query = SalespersonQuerySchema.parse(searchParams);
  const pagination = paginationQuerySchema.parse(searchParams);

  const result = await listSalespersons(query, pagination);

  return NextResponse.json(result);
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const user = await requireAuth(request);
  if (user.role !== 'ADMIN') {
    forbidden('この操作を行う権限がありません');
  }

  const body = SalespersonInputSchema.parse(await request.json());
  const result = await createSalesperson(body);

  return NextResponse.json(result, { status: HttpStatus.CREATED });
});
