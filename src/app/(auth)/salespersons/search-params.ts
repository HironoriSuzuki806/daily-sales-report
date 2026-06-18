export type SalespersonListParams = {
  /** 氏名（部分一致）。未指定は undefined */
  name?: string;
  /** 所属部署ID。未指定は undefined */
  departmentId?: string;
  /** ロール。'SALES' | 'MANAGER' | 'ADMIN'。未指定（すべて）は undefined */
  role?: string;
  /** 有効フラグ。'true' | 'false'。未指定（すべて）は undefined */
  isActive?: string;
  /** 0始まりのページ番号 */
  page: number;
};

type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

const VALID_ROLES = ['SALES', 'MANAGER', 'ADMIN'] as const;

export function parseSalespersonListParams(searchParams: RawSearchParams): SalespersonListParams {
  const name = firstValue(searchParams.name)?.trim();
  const departmentId = firstValue(searchParams.departmentId);
  const role = firstValue(searchParams.role);
  const isActive = firstValue(searchParams.isActive);
  const rawPage = firstValue(searchParams.page);

  const parsedPage = rawPage !== undefined ? parseInt(rawPage, 10) : 0;
  const page = Number.isInteger(parsedPage) && parsedPage >= 0 ? parsedPage : 0;

  return {
    name: name ? name : undefined,
    departmentId: departmentId && /^\d+$/.test(departmentId) ? departmentId : undefined,
    role: VALID_ROLES.includes(role as (typeof VALID_ROLES)[number]) ? role : undefined,
    isActive: isActive === 'true' || isActive === 'false' ? isActive : undefined,
    page,
  };
}

export function buildSalespersonsPath(
  params: SalespersonListParams,
  page: number = params.page
): string {
  const query = new URLSearchParams();
  if (params.name) query.set('name', params.name);
  if (params.departmentId) query.set('departmentId', params.departmentId);
  if (params.role) query.set('role', params.role);
  if (params.isActive !== undefined) query.set('isActive', params.isActive);
  if (page > 0) query.set('page', String(page));

  const qs = query.toString();
  return qs ? `/salespersons?${qs}` : '/salespersons';
}
