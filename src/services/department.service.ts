import { Prisma } from '@/generated/prisma/client';
import { badRequest, notFound } from '@/lib/api';
import { createPageResponse, PaginationQuery, PageResponse } from '@/lib/api/pagination';
import { formatDatetime } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import type {
  DepartmentCreate,
  DepartmentUpdate,
  DepartmentQuery,
} from '@/lib/schemas/department.schema';

// ─── Response types ────────────────────────────────────────────────────────────

export interface DepartmentResponse {
  id: number;
  name: string;
  parentDepartment: { id: number; name: string } | null;
  manager: { id: number; name: string } | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Prisma include shape ──────────────────────────────────────────────────────

const departmentInclude = {
  parentDepartment: { select: { id: true, name: true } },
  manager: { select: { id: true, name: true } },
} satisfies Prisma.DepartmentInclude;

type DepartmentWithRelations = Prisma.DepartmentGetPayload<{
  include: typeof departmentInclude;
}>;

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapToResponse(d: DepartmentWithRelations): DepartmentResponse {
  return {
    id: Number(d.id),
    name: d.name,
    parentDepartment: d.parentDepartment
      ? { id: Number(d.parentDepartment.id), name: d.parentDepartment.name }
      : null,
    manager: d.manager ? { id: Number(d.manager.id), name: d.manager.name } : null,
    isActive: d.isActive,
    createdAt: formatDatetime(d.createdAt),
    updatedAt: formatDatetime(d.updatedAt),
  };
}

// ─── Cycle detection ──────────────────────────────────────────────────────────

async function wouldCreateCycle(departmentId: bigint, newParentId: bigint): Promise<boolean> {
  let current: bigint | null = newParentId;
  while (current !== null) {
    if (current === departmentId) return true;
    const dept: { parentDepartmentId: bigint | null } | null = await prisma.department.findUnique({
      where: { id: current },
      select: { parentDepartmentId: true },
    });
    if (!dept) break;
    current = dept.parentDepartmentId;
  }
  return false;
}

// ─── Service functions ─────────────────────────────────────────────────────────

export async function listDepartments(
  query: DepartmentQuery,
  pagination: PaginationQuery
): Promise<PageResponse<DepartmentResponse>> {
  const where: Prisma.DepartmentWhereInput = {};

  if (query.name !== undefined) {
    where.name = { contains: query.name, mode: 'insensitive' };
  }
  if (query.parentDepartmentId !== undefined) {
    where.parentDepartmentId = BigInt(query.parentDepartmentId);
  }
  if (query.isActive !== undefined) {
    where.isActive = query.isActive;
  }

  const [total, departments] = await prisma.$transaction([
    prisma.department.count({ where }),
    prisma.department.findMany({
      where,
      include: departmentInclude,
      skip: pagination.page * pagination.size,
      take: pagination.size,
      orderBy: { id: 'asc' },
    }),
  ]);

  return createPageResponse(departments.map(mapToResponse), total, pagination);
}

export async function getDepartment(id: number): Promise<DepartmentResponse> {
  const department = await prisma.department.findUnique({
    where: { id: BigInt(id) },
    include: departmentInclude,
  });

  if (!department) {
    notFound('部署が見つかりません');
  }

  return mapToResponse(department);
}

export async function createDepartment(input: DepartmentCreate): Promise<DepartmentResponse> {
  if (input.parentDepartmentId !== undefined) {
    const parent = await prisma.department.findUnique({
      where: { id: BigInt(input.parentDepartmentId) },
      select: { id: true },
    });
    if (!parent) {
      badRequest('指定された上位部署が存在しません');
    }
  }

  if (input.managerId !== undefined) {
    const manager = await prisma.salesperson.findUnique({
      where: { id: BigInt(input.managerId) },
      select: { id: true },
    });
    if (!manager) {
      badRequest('指定された部署長が存在しません');
    }
  }

  const department = await prisma.department.create({
    data: {
      name: input.name,
      parentDepartmentId: input.parentDepartmentId ? BigInt(input.parentDepartmentId) : null,
      managerId: input.managerId ? BigInt(input.managerId) : null,
      isActive: input.isActive,
    },
    include: departmentInclude,
  });

  return mapToResponse(department);
}

export async function updateDepartment(
  id: number,
  input: DepartmentUpdate
): Promise<DepartmentResponse> {
  const existing = await prisma.department.findUnique({
    where: { id: BigInt(id) },
    select: { id: true },
  });
  if (!existing) {
    notFound('部署が見つかりません');
  }

  if (input.parentDepartmentId !== undefined && input.parentDepartmentId !== null) {
    if (BigInt(input.parentDepartmentId) === BigInt(id)) {
      badRequest('自部署を上位部署に指定することはできません');
    }

    const parent = await prisma.department.findUnique({
      where: { id: BigInt(input.parentDepartmentId) },
      select: { id: true },
    });
    if (!parent) {
      badRequest('指定された上位部署が存在しません');
    }

    const cyclic = await wouldCreateCycle(BigInt(id), BigInt(input.parentDepartmentId));
    if (cyclic) {
      badRequest('上位部署の設定が循環しています');
    }
  }

  if (input.managerId !== undefined && input.managerId !== null) {
    const manager = await prisma.salesperson.findUnique({
      where: { id: BigInt(input.managerId) },
      select: { id: true },
    });
    if (!manager) {
      badRequest('指定された部署長が存在しません');
    }
  }

  const department = await prisma.department.update({
    where: { id: BigInt(id) },
    data: {
      name: input.name,
      parentDepartmentId:
        input.parentDepartmentId !== undefined
          ? input.parentDepartmentId !== null
            ? BigInt(input.parentDepartmentId)
            : null
          : undefined,
      managerId:
        input.managerId !== undefined
          ? input.managerId !== null
            ? BigInt(input.managerId)
            : null
          : undefined,
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
    include: departmentInclude,
  });

  return mapToResponse(department);
}

export async function deleteDepartment(id: number): Promise<void> {
  const existing = await prisma.department.findUnique({
    where: { id: BigInt(id) },
    select: { id: true },
  });
  if (!existing) {
    notFound('部署が見つかりません');
  }

  await prisma.department.update({
    where: { id: BigInt(id) },
    data: { isActive: false },
  });
}
