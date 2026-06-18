import { Prisma } from '@/generated/prisma/client';
import { notFound, badRequest } from '@/lib/api';
import { createPageResponse, PaginationQuery, PageResponse } from '@/lib/api/pagination';
import { parseSortParam } from '@/lib/api/sort';
import { formatDatetime } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import type { CustomerCreate, CustomerUpdate, CustomerQuery } from '@/lib/schemas/customer.schema';

const CUSTOMER_SORT_FIELDS = ['id', 'name', 'createdAt', 'updatedAt'] as const;

// ─── Response types ────────────────────────────────────────────────────────────

export interface CustomerResponse {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  salesRep: { id: number; name: string } | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Prisma include shape ──────────────────────────────────────────────────────

const customerInclude = {
  salesRep: { select: { id: true, name: true } },
} satisfies Prisma.CustomerInclude;

type CustomerWithRelations = Prisma.CustomerGetPayload<{
  include: typeof customerInclude;
}>;

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapToResponse(customer: CustomerWithRelations): CustomerResponse {
  return {
    id: Number(customer.id),
    name: customer.name,
    address: customer.address ?? null,
    phone: customer.phone ?? null,
    salesRep: customer.salesRep
      ? { id: Number(customer.salesRep.id), name: customer.salesRep.name }
      : null,
    isActive: customer.isActive,
    createdAt: formatDatetime(customer.createdAt),
    updatedAt: formatDatetime(customer.updatedAt),
  };
}

// ─── Service functions ─────────────────────────────────────────────────────────

export async function listCustomers(
  query: CustomerQuery,
  pagination: PaginationQuery
): Promise<PageResponse<CustomerResponse>> {
  const where: Prisma.CustomerWhereInput = {};

  if (query.name !== undefined) {
    where.name = { contains: query.name, mode: 'insensitive' };
  }
  if (query.salesRepId !== undefined) {
    where.salesRepId = BigInt(query.salesRepId);
  }
  if (query.isActive !== undefined) {
    where.isActive = query.isActive;
  }

  const orderBy = parseSortParam(pagination.sort, CUSTOMER_SORT_FIELDS) ?? { id: 'asc' };

  const [total, customers] = await prisma.$transaction([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      include: customerInclude,
      orderBy,
      skip: pagination.page * pagination.size,
      take: pagination.size,
    }),
  ]);

  return createPageResponse(customers.map(mapToResponse), total, pagination);
}

export async function getCustomer(id: number): Promise<CustomerResponse> {
  const customer = await prisma.customer.findUnique({
    where: { id: BigInt(id) },
    include: customerInclude,
  });
  if (!customer) {
    notFound('顧客が見つかりません');
  }
  return mapToResponse(customer);
}

export async function createCustomer(input: CustomerCreate): Promise<CustomerResponse> {
  if (input.salesRepId !== undefined) {
    const exists = await prisma.salesperson.findUnique({
      where: { id: BigInt(input.salesRepId), isActive: true },
      select: { id: true },
    });
    if (!exists) {
      badRequest('指定された担当営業が見つかりません');
    }
  }

  const customer = await prisma.customer.create({
    data: {
      name: input.name,
      address: input.address ?? null,
      phone: input.phone ?? null,
      salesRepId: input.salesRepId ? BigInt(input.salesRepId) : null,
      isActive: input.isActive,
    },
    include: customerInclude,
  });

  return mapToResponse(customer);
}

export async function updateCustomer(id: number, input: CustomerUpdate): Promise<CustomerResponse> {
  const existing = await prisma.customer.findUnique({
    where: { id: BigInt(id) },
    select: { id: true },
  });
  if (!existing) {
    notFound('顧客が見つかりません');
  }

  if (input.salesRepId !== undefined) {
    const exists = await prisma.salesperson.findUnique({
      where: { id: BigInt(input.salesRepId), isActive: true },
      select: { id: true },
    });
    if (!exists) {
      badRequest('指定された担当営業が見つかりません');
    }
  }

  const customer = await prisma.customer.update({
    where: { id: BigInt(id) },
    data: {
      name: input.name,
      address: input.address ?? null,
      phone: input.phone ?? null,
      salesRepId: input.salesRepId ? BigInt(input.salesRepId) : null,
      isActive: input.isActive,
    },
    include: customerInclude,
  });

  return mapToResponse(customer);
}

export async function deactivateCustomer(id: number): Promise<void> {
  const existing = await prisma.customer.findUnique({
    where: { id: BigInt(id) },
    select: { id: true },
  });
  if (!existing) {
    notFound('顧客が見つかりません');
  }

  await prisma.customer.update({
    where: { id: BigInt(id) },
    data: { isActive: false },
  });
}
