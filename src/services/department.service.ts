import { Prisma } from '@/generated/prisma/client';
import { badRequest, notFound } from '@/lib/api';
import { createPageResponse, PaginationQuery } from '@/lib/api/pagination';
import { formatDatetime } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import type {
  DepartmentInput,
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

// ─── Mapper ───────────────────────────────────────────────────────────────────

type DepartmentWithRelations = Prisma.DepartmentGetPayload<{
  include: typeof departmentInclude;
}>;

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

// ─── Validation helpers ────────────────────────────────────────────────────────

/** managerId が営業マスタに存在することを確認する */
async function validateManagerExists(managerId: number): Promise<void> {
  const manager = await prisma.salesperson.findUnique({
    where: { id: BigInt(managerId) },
    select: { id: true },
  });
  if (!manager) {
    badRequest('指定された部署長が存在しません');
  }
}

/** parentDepartmentId の存在チェックと、自部署指定・循環チェックを行う */
async function validateParentDepartment(
  parentDepartmentId: number,
  selfId: number | null
): Promise<void> {
  if (selfId !== null && parentDepartmentId === selfId) {
    badRequest('上位部署に自部署は指定できません');
  }

  const parent = await prisma.department.findUnique({
    where: { id: BigInt(parentDepartmentId) },
    select: { id: true, parentDepartmentId: true },
  });
  if (!parent) {
    badRequest('指定された上位部署が存在しません');
  }

  // 新しい親から祖先を辿り、自部署に到達したら循環
  if (selfId === null) return;

  const visited = new Set<number>([parentDepartmentId]);
  let currentParentId = parent.parentDepartmentId;
  while (currentParentId !== null) {
    const currentId = Number(currentParentId);
    if (currentId === selfId) {
      badRequest('部署の階層が循環しています');
    }
    if (visited.has(currentId)) break; // 既存データの循環で無限ループしないよう防御
    visited.add(currentId);

    const ancestor = await prisma.department.findUnique({
      where: { id: currentParentId },
      select: { parentDepartmentId: true },
    });
    currentParentId = ancestor?.parentDepartmentId ?? null;
  }
}

// ─── Service functions ─────────────────────────────────────────────────────────

export async function listDepartments(query: DepartmentQuery, pagination: PaginationQuery) {
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

export async function createDepartment(input: DepartmentInput): Promise<DepartmentResponse> {
  if (input.managerId !== undefined && input.managerId !== null) {
    await validateManagerExists(input.managerId);
  }
  if (input.parentDepartmentId !== undefined && input.parentDepartmentId !== null) {
    await validateParentDepartment(input.parentDepartmentId, null);
  }

  const department = await prisma.department.create({
    data: {
      name: input.name,
      parentDepartmentId:
        input.parentDepartmentId !== undefined && input.parentDepartmentId !== null
          ? BigInt(input.parentDepartmentId)
          : null,
      managerId:
        input.managerId !== undefined && input.managerId !== null ? BigInt(input.managerId) : null,
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

  if (input.managerId !== undefined && input.managerId !== null) {
    await validateManagerExists(input.managerId);
  }
  if (input.parentDepartmentId !== undefined && input.parentDepartmentId !== null) {
    await validateParentDepartment(input.parentDepartmentId, id);
  }

  const data: Prisma.DepartmentUncheckedUpdateInput = { name: input.name };
  if (input.parentDepartmentId !== undefined) {
    data.parentDepartmentId =
      input.parentDepartmentId !== null ? BigInt(input.parentDepartmentId) : null;
  }
  if (input.managerId !== undefined) {
    data.managerId = input.managerId !== null ? BigInt(input.managerId) : null;
  }
  if (input.isActive !== undefined) {
    data.isActive = input.isActive;
  }

  const department = await prisma.department.update({
    where: { id: BigInt(id) },
    data,
    include: departmentInclude,
  });

  return mapToResponse(department);
}

export async function deleteDepartment(id: number): Promise<void> {
  try {
    await prisma.department.update({
      where: { id: BigInt(id) },
      data: { isActive: false },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      notFound('部署が見つかりません');
    }
    throw err;
  }
}
