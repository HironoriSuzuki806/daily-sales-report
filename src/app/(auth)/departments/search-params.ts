/**
 * SCR-401 部署マスタ一覧の検索条件パラメータの解析・URL生成ヘルパー。
 */

export type DepartmentListParams = {
  /** 部署名（部分一致）。未指定は undefined */
  name?: string;
  /** 上位部署ID。未指定は undefined */
  parentDepartmentId?: string;
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

/** 空文字・不正値を undefined に正規化しつつ searchParams を解析する。 */
export function parseDepartmentListParams(searchParams: RawSearchParams): DepartmentListParams {
  const name = firstValue(searchParams.name)?.trim();
  const parentDepartmentId = firstValue(searchParams.parentDepartmentId);
  const isActive = firstValue(searchParams.isActive);
  const rawPage = firstValue(searchParams.page);

  const parsedPage = rawPage !== undefined ? parseInt(rawPage, 10) : 0;
  const page = Number.isInteger(parsedPage) && parsedPage >= 0 ? parsedPage : 0;

  return {
    name: name ? name : undefined,
    parentDepartmentId:
      parentDepartmentId && /^\d+$/.test(parentDepartmentId) ? parentDepartmentId : undefined,
    isActive: isActive === 'true' || isActive === 'false' ? isActive : undefined,
    page,
  };
}

/** 検索条件＋ページ番号から /departments のクエリ文字列付きパスを生成する。 */
export function buildDepartmentsPath(
  params: DepartmentListParams,
  page: number = params.page
): string {
  const query = new URLSearchParams();
  if (params.name) query.set('name', params.name);
  if (params.parentDepartmentId) query.set('parentDepartmentId', params.parentDepartmentId);
  if (params.isActive) query.set('isActive', params.isActive);
  if (page > 0) query.set('page', String(page));

  const qs = query.toString();
  return qs ? `/departments?${qs}` : '/departments';
}
