import { NextRequest, NextResponse } from 'next/server';

import { requireAuth, withErrorHandler, forbidden } from '@/lib/api';
import { HttpStatus } from '@/lib/api/http-status';
import { paginationQuerySchema } from '@/lib/api/pagination';
import { CustomerCreateSchema, CustomerQuerySchema } from '@/lib/schemas/customer.schema';
import { listCustomers, createCustomer } from '@/services/customer.service';

export const GET = withErrorHandler(async (request: NextRequest) => {
  await requireAuth(request);

  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  const query = CustomerQuerySchema.parse(searchParams);
  const pagination = paginationQuerySchema.parse(searchParams);

  const result = await listCustomers(query, pagination);
  return NextResponse.json(result, { status: HttpStatus.OK });
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const user = await requireAuth(request);
  if (user.role !== 'ADMIN') {
    forbidden('この操作を行う権限がありません');
  }

  const body = CustomerCreateSchema.parse(await request.json());
  const result = await createCustomer(body);
  return NextResponse.json(result, { status: HttpStatus.CREATED });
});
