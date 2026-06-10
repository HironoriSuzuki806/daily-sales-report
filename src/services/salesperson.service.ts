import bcrypt from 'bcryptjs';
import { Prisma } from '@/generated/prisma/client';
import { badRequest, conflict, notFound } from '@/lib/api';
import { createPageResponse, PaginationQuery } from '@/lib/api/pagination';
import { formatDatetime } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import type {
  SalespersonInput,
  SalespersonUpdate,
  SalespersonQuery,
} from '@/lib/schemas/salesperson.schema';

// ─── Response types ────────────────────────────────────────────────────────────

export interface SalespersonResponse {
  id: number;
  name: string;
  email: string;
  role: 'SALES' | 'MANAGER' | 'ADMIN';
  department: { id: number; name: string } | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Prisma include shape ──────────────────────────────────────────────────────

const salespersonInclude = {
  department: { select: { id: true, name: true } },
} satisfies Prisma.SalespersonInclude;

// ─── Mapper ───────────────────────────────────────────────────────────────────

type SalespersonWithRelations = Prisma.SalespersonGetPayload<{
  include: typeof salespersonInclude;
}>;

function mapToResponse(s: SalespersonWithRelations): SalespersonResponse {
  return {
    id: Number(s.id),
    name: s.name,
    email: s.email,
    role: s.role as SalespersonResponse['role'],
    department: s.department ? { id: Number(s.department.id), name: s.department.name } : null,
    isActive: s.isActive,
    createdAt: formatDatetime(s.createdAt),
    updatedAt: formatDatetime(s.updatedAt),
  };
}

// ─── Service functions ─────────────────────────────────────────────────────────

export async function listSalespersons(query: SalespersonQuery, pagination: PaginationQuery) {
  const where: Prisma.SalespersonWhereInput = {};

  if (query.name !== undefined) {
    where.name = { contains: query.name, mode: 'insensitive' };
  }
  if (query.departmentId !== undefined) {
    where.departmentId = BigInt(query.departmentId);
  }
  if (query.role !== undefined) {
    where.role = query.role;
  }
  if (query.isActive !== undefined) {
    where.isActive = query.isActive;
  }

  const [total, salespersons] = await prisma.$transaction([
    prisma.salesperson.count({ where }),
    prisma.salesperson.findMany({
      where,
      include: salespersonInclude,
      skip: pagination.page * pagination.size,
      take: pagination.size,
      orderBy: { id: 'asc' },
    }),
  ]);

  return createPageResponse(salespersons.map(mapToResponse), total, pagination);
}

export async function getSalesperson(id: number): Promise<SalespersonResponse> {
  const salesperson = await prisma.salesperson.findUnique({
    where: { id: BigInt(id) },
    include: salespersonInclude,
  });

  if (!salesperson) {
    notFound('営業が見つかりません');
  }

  return mapToResponse(salesperson);
}

export async function createSalesperson(input: SalespersonInput): Promise<SalespersonResponse> {
  const passwordHash = await bcrypt.hash(input.password, 10);

  try {
    const salesperson = await prisma.salesperson.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        role: input.role,
        departmentId: BigInt(input.departmentId),
        isActive: input.isActive,
      },
      include: salespersonInclude,
    });

    return mapToResponse(salesperson);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') {
        conflict('このメールアドレスはすでに使用されています');
      }
      if (err.code === 'P2003') {
        badRequest('指定された部署が存在しません');
      }
    }
    throw err;
  }
}

export async function updateSalesperson(
  id: number,
  input: SalespersonUpdate
): Promise<SalespersonResponse> {
  try {
    const data: Prisma.SalespersonUpdateInput = {
      name: input.name,
      email: input.email,
      role: input.role,
      departmentId: BigInt(input.departmentId),
    };
    if (input.isActive !== undefined) {
      data.isActive = input.isActive;
    }
    const salesperson = await prisma.salesperson.update({
      where: { id: BigInt(id) },
      data,
      include: salespersonInclude,
    });
    return mapToResponse(salesperson);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') conflict('このメールアドレスは既に使用されています');
      if (err.code === 'P2025') notFound('営業が見つかりません');
      if (err.code === 'P2003') badRequest('指定された部署が存在しません');
    }
    throw err;
  }
}

export async function deleteSalesperson(id: number): Promise<void> {
  try {
    await prisma.salesperson.update({
      where: { id: BigInt(id) },
      data: { isActive: false },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      notFound('営業が見つかりません');
    }
    throw err;
  }
}
