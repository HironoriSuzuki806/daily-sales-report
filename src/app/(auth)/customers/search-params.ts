/**
 * SCR-201 顧客マスタ一覧の検索条件パラメータの解析・URL生成ヘルパー。
 *
 * URL の searchParams（文字列）と、サービス層へ渡すクエリ
 * （CustomerQuery / PaginationQuery）の橋渡しを行う。
 */

export type CustomerListParams = {
  /** 顧客名（部分一致）。未指定は undefined */
  name?: string;
  /** 担当営業ID。未指定は undefined */
  salesRepId?: string;
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
export function parseCustomerListParams(searchParams: RawSearchParams): CustomerListParams {
  const name = firstValue(searchParams.name)?.trim();
  const salesRepId = firstValue(searchParams.salesRepId);
  const isActive = firstValue(searchParams.isActive);
  const rawPage = firstValue(searchParams.page);

  const parsedPage = rawPage !== undefined ? parseInt(rawPage, 10) : 0;
  const page = Number.isInteger(parsedPage) && parsedPage >= 0 ? parsedPage : 0;

  return {
    name: name ? name : undefined,
    salesRepId: salesRepId && /^\d+$/.test(salesRepId) ? salesRepId : undefined,
    isActive: isActive === 'true' || isActive === 'false' ? isActive : undefined,
    page,
  };
}

/** 検索条件＋ページ番号から /customers のクエリ文字列付きパスを生成する。 */
export function buildCustomersPath(params: CustomerListParams, page: number = params.page): string {
  const query = new URLSearchParams();
  if (params.name) query.set('name', params.name);
  if (params.salesRepId) query.set('salesRepId', params.salesRepId);
  if (params.isActive !== undefined) query.set('isActive', params.isActive);
  if (page > 0) query.set('page', String(page));

  const qs = query.toString();
  return qs ? `/customers?${qs}` : '/customers';
}
