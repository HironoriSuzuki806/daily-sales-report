export type DailyReportListParams = {
  /** 報告日（開始）。YYYY-MM-DD。未指定は undefined */
  dateFrom?: string;
  /** 報告日（終了）。YYYY-MM-DD。未指定は undefined */
  dateTo?: string;
  /** 営業担当 ID。MANAGER 向け絞り込み。未指定は undefined */
  salespersonId?: string;
  /** ステータス。'DRAFT' | 'SUBMITTED'。未指定（すべて）は undefined */
  status?: string;
  /** 0始まりのページ番号 */
  page: number;
};

type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

const VALID_STATUSES = ['DRAFT', 'SUBMITTED'] as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDailyReportListParams(searchParams: RawSearchParams): DailyReportListParams {
  const dateFrom = firstValue(searchParams.dateFrom);
  const dateTo = firstValue(searchParams.dateTo);
  const salespersonId = firstValue(searchParams.salespersonId);
  const status = firstValue(searchParams.status);
  const rawPage = firstValue(searchParams.page);

  const parsedPage = rawPage !== undefined ? parseInt(rawPage, 10) : 0;
  const page = Number.isInteger(parsedPage) && parsedPage >= 0 ? parsedPage : 0;

  return {
    dateFrom: dateFrom && DATE_RE.test(dateFrom) ? dateFrom : undefined,
    dateTo: dateTo && DATE_RE.test(dateTo) ? dateTo : undefined,
    salespersonId: salespersonId && /^\d+$/.test(salespersonId) ? salespersonId : undefined,
    status: VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number]) ? status : undefined,
    page,
  };
}

export function buildReportsPath(
  params: DailyReportListParams,
  page: number = params.page
): string {
  const query = new URLSearchParams();
  if (params.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params.dateTo) query.set('dateTo', params.dateTo);
  if (params.salespersonId) query.set('salespersonId', params.salespersonId);
  if (params.status) query.set('status', params.status);
  if (page > 0) query.set('page', String(page));

  const qs = query.toString();
  return qs ? `/reports?${qs}` : '/reports';
}
