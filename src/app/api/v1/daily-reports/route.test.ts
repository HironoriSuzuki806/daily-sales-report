// @vitest-environment node
import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { GET, POST } from './route';

vi.mock('@/services/daily-report.service', () => ({
  createDailyReport: vi.fn(),
  listDailyReports: vi.fn(),
}));

vi.mock('@/lib/api/auth', () => ({
  requireAuth: vi.fn(),
  getCurrentUser: vi.fn(),
  extractBearerToken: vi.fn(),
}));

import { createDailyReport, listDailyReports } from '@/services/daily-report.service';
import { requireAuth } from '@/lib/api/auth';
const mockCreateDailyReport = createDailyReport as ReturnType<typeof vi.fn>;
const mockListDailyReports = listDailyReports as ReturnType<typeof vi.fn>;
const mockRequireAuth = requireAuth as ReturnType<typeof vi.fn>;

const salesUser = {
  id: 12,
  name: '山田太郎',
  email: 'yamada@example.com',
  role: 'SALES' as const,
  departmentId: 3,
};

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/v1/daily-reports', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer dummy-token' },
  });
}

const baseReportResponse = {
  id: 1001,
  reportDate: '2026-06-04',
  salesperson: { id: 12, name: '山田太郎' },
  status: 'DRAFT',
  submittedAt: null,
  problem: null,
  plan: null,
  visitRecords: [],
  comments: [],
  createdAt: '2026-06-04T10:00:00Z',
  updatedAt: '2026-06-04T10:00:00Z',
};

describe('POST /api/v1/daily-reports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(salesUser);
  });

  it('TC-RPT-001: 正常作成 → 201 + status=DRAFT', async () => {
    mockCreateDailyReport.mockResolvedValue(baseReportResponse);

    const res = await POST(makeRequest({ reportDate: '2026-06-04' }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.id).toBe(1001);
    expect(body.status).toBe('DRAFT');
    expect(body.salesperson.id).toBe(12);
    expect(mockCreateDailyReport).toHaveBeenCalledWith(
      12,
      expect.objectContaining({ reportDate: '2026-06-04' })
    );
  });

  it('TC-RPT-002: 訪問記録複数行登録', async () => {
    const reportWithVisits = {
      ...baseReportResponse,
      visitRecords: [
        {
          id: 5001,
          customer: { id: 30, name: 'ABC商事' },
          visitTime: '10:00',
          visitContent: '提案',
          sortOrder: 1,
        },
        {
          id: 5002,
          customer: { id: 31, name: 'XYZ工業' },
          visitTime: '14:00',
          visitContent: 'フォロー',
          sortOrder: 2,
        },
      ],
    };
    mockCreateDailyReport.mockResolvedValue(reportWithVisits);

    const res = await POST(
      makeRequest({
        reportDate: '2026-06-04',
        visitRecords: [
          { customerId: 30, visitTime: '10:00', visitContent: '提案', sortOrder: 1 },
          { customerId: 31, visitTime: '14:00', visitContent: 'フォロー', sortOrder: 2 },
        ],
      })
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.visitRecords).toHaveLength(2);
    expect(body.visitRecords[0].sortOrder).toBe(1);
  });

  it('TC-RPT-003: 同一日重複 → 409', async () => {
    const { ApiError } = await import('@/lib/api');
    mockCreateDailyReport.mockRejectedValue(new ApiError(409, '同一日の日報が既に存在します'));

    const res = await POST(makeRequest({ reportDate: '2026-06-04' }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.message).toBe('同一日の日報が既に存在します');
  });

  it('TC-RPT-004: 報告日未入力 → 400', async () => {
    const res = await POST(makeRequest({}));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.fieldErrors).toBeDefined();
    expect(body.fieldErrors.some((e: { field: string }) => e.field === 'reportDate')).toBe(true);
  });

  it('報告日が YYYY-MM-DD 形式以外 → 400', async () => {
    const res = await POST(makeRequest({ reportDate: '2026/06/04' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.fieldErrors.some((e: { field: string }) => e.field === 'reportDate')).toBe(true);
  });

  it('visitContent が2001文字 → 400', async () => {
    const res = await POST(
      makeRequest({
        reportDate: '2026-06-04',
        visitRecords: [{ sortOrder: 1, visitContent: 'a'.repeat(2001) }],
      })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.fieldErrors.some((e: { field: string }) => e.field.includes('visitContent'))).toBe(
      true
    );
  });

  it('visitContent が2000文字 → 正常', async () => {
    mockCreateDailyReport.mockResolvedValue(baseReportResponse);

    const res = await POST(
      makeRequest({
        reportDate: '2026-06-04',
        visitRecords: [{ sortOrder: 1, visitContent: 'a'.repeat(2000) }],
      })
    );

    expect(res.status).toBe(201);
  });

  it('未認証 → 401', async () => {
    const { ApiError } = await import('@/lib/api');
    mockRequireAuth.mockRejectedValue(new ApiError(401, '認証が必要です'));

    const res = await POST(makeRequest({ reportDate: '2026-06-04' }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.message).toBe('認証が必要です');
  });

  it('ADMIN ロール → 403', async () => {
    mockRequireAuth.mockResolvedValue({
      ...salesUser,
      role: 'ADMIN' as const,
    });

    const res = await POST(makeRequest({ reportDate: '2026-06-04' }));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.message).toBe('この操作を行う権限がありません');
  });

  it('MANAGER ロール → 201（SALESと同様に作成可能）', async () => {
    mockRequireAuth.mockResolvedValue({ ...salesUser, role: 'MANAGER' as const });
    mockCreateDailyReport.mockResolvedValue(baseReportResponse);

    const res = await POST(makeRequest({ reportDate: '2026-06-04' }));

    expect(res.status).toBe(201);
  });

  it('reportDate が存在しない日付（2026-02-30）→ 400', async () => {
    const res = await POST(makeRequest({ reportDate: '2026-02-30' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.fieldErrors.some((e: { field: string }) => e.field === 'reportDate')).toBe(true);
  });

  it('visitTime が無効な時刻（25:00）→ 400', async () => {
    const res = await POST(
      makeRequest({
        reportDate: '2026-06-04',
        visitRecords: [{ sortOrder: 1, visitTime: '25:00' }],
      })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.fieldErrors.some((e: { field: string }) => e.field.includes('visitTime'))).toBe(
      true
    );
  });
});

function makeGetRequest(queryString = '') {
  return new NextRequest(`http://localhost/api/v1/daily-reports${queryString}`, {
    method: 'GET',
    headers: { Authorization: 'Bearer dummy-token' },
  });
}

const emptyPageResponse = {
  content: [],
  page: 0,
  size: 20,
  totalElements: 0,
  totalPages: 0,
};

describe('GET /api/v1/daily-reports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(salesUser);
    mockListDailyReports.mockResolvedValue(emptyPageResponse);
  });

  it('200 + ページングレスポンス形式で返る', async () => {
    const listItem = {
      id: 1001,
      reportDate: '2026-06-04',
      salesperson: { id: 12, name: '山田太郎' },
      visitCount: 3,
      status: 'SUBMITTED',
      commentCount: 1,
    };
    mockListDailyReports.mockResolvedValue({
      content: [listItem],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });

    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.content).toHaveLength(1);
    expect(body.content[0]).toEqual(listItem);
    expect(body.page).toBe(0);
    expect(body.size).toBe(20);
    expect(body.totalElements).toBe(1);
    expect(body.totalPages).toBe(1);
  });

  it('クエリパラメータがサービスに渡る', async () => {
    const res = await GET(
      makeGetRequest(
        '?dateFrom=2026-06-01&dateTo=2026-06-30&salespersonId=12&status=SUBMITTED&page=1&size=10'
      )
    );

    expect(res.status).toBe(200);
    expect(mockListDailyReports).toHaveBeenCalledWith(
      salesUser,
      {
        dateFrom: '2026-06-01',
        dateTo: '2026-06-30',
        salespersonId: 12,
        status: 'SUBMITTED',
      },
      expect.objectContaining({ page: 1, size: 10 })
    );
  });

  it('dateFrom が YYYY-MM-DD 形式以外 → 400', async () => {
    const res = await GET(makeGetRequest('?dateFrom=2026/06/01'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.fieldErrors.some((e: { field: string }) => e.field === 'dateFrom')).toBe(true);
  });

  it('dateTo が存在しない日付（2026-02-30）→ 400', async () => {
    const res = await GET(makeGetRequest('?dateTo=2026-02-30'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.fieldErrors.some((e: { field: string }) => e.field === 'dateTo')).toBe(true);
  });

  it('status が不正値 → 400', async () => {
    const res = await GET(makeGetRequest('?status=INVALID'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.fieldErrors.some((e: { field: string }) => e.field === 'status')).toBe(true);
  });

  it('size が 101 → 400', async () => {
    const res = await GET(makeGetRequest('?size=101'));

    expect(res.status).toBe(400);
  });

  it('未認証 → 401', async () => {
    const { ApiError } = await import('@/lib/api');
    mockRequireAuth.mockRejectedValue(new ApiError(401, '認証が必要です'));

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(401);
  });

  it('ADMIN ロール → 403', async () => {
    mockRequireAuth.mockResolvedValue({ ...salesUser, role: 'ADMIN' as const });

    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.message).toBe('この操作を行う権限がありません');
    expect(mockListDailyReports).not.toHaveBeenCalled();
  });

  it('MANAGER ロール → 200', async () => {
    mockRequireAuth.mockResolvedValue({ ...salesUser, role: 'MANAGER' as const });

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(200);
  });
});
