import { NextRequest, NextResponse } from 'next/server';

import { requireAuth, withErrorHandler, forbidden, badRequest } from '@/lib/api';
import { HttpStatus } from '@/lib/api/http-status';
import { CustomerUpdateSchema } from '@/lib/schemas/customer.schema';
import { getCustomer, updateCustomer, deactivateCustomer } from '@/services/customer.service';

export const GET = withErrorHandler(
  async (request: NextRequest, context?: { params: Promise<Record<string, string>> }) => {
    await requireAuth(request);

    const { id: idStr } = await context!.params;
    const id = parseInt(idStr, 10);
    if (!Number.isFinite(id) || id <= 0) {
      badRequest('無効なIDです');
    }

    const result = await getCustomer(id);
    return NextResponse.json(result, { status: HttpStatus.OK });
  }
);

export const PUT = withErrorHandler(
  async (request: NextRequest, context?: { params: Promise<Record<string, string>> }) => {
    const user = await requireAuth(request);
    if (user.role !== 'ADMIN') {
      forbidden('この操作を行う権限がありません');
    }

    const { id: idStr } = await context!.params;
    const id = parseInt(idStr, 10);
    if (!Number.isFinite(id) || id <= 0) {
      badRequest('無効なIDです');
    }

    const body = CustomerUpdateSchema.parse(await request.json());
    const result = await updateCustomer(id, body);
    return NextResponse.json(result, { status: HttpStatus.OK });
  }
);

export const DELETE = withErrorHandler(
  async (request: NextRequest, context?: { params: Promise<Record<string, string>> }) => {
    const user = await requireAuth(request);
    if (user.role !== 'ADMIN') {
      forbidden('この操作を行う権限がありません');
    }

    const { id: idStr } = await context!.params;
    const id = parseInt(idStr, 10);
    if (!Number.isFinite(id) || id <= 0) {
      badRequest('無効なIDです');
    }

    await deactivateCustomer(id);
    return new NextResponse(null, { status: HttpStatus.NO_CONTENT });
  }
);
