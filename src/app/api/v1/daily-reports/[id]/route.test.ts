// @vitest-environment node
import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { GET, PUT, DELETE } from './route';

vi.mock('@/services/daily-report.service', () => ({
  getDailyReport: vi.fn(),
  updateDailyReport: vi.fn(),
  deleteDailyReport: vi.fn(),
}));

vi.mock('@/lib/api/auth', () => ({
  requireAuth: vi.fn(),
  getCurrentUser: vi.fn(),
  extractBearerToken: vi.fn(),
}));

import {
  getDailyReport,
  updateDailyReport,
  deleteDailyReport,
} from '@/services/daily-report.service';
import { requireAuth } from '@/lib/api/auth';
const mockGetDailyReport = getDailyReport as ReturnType<typeof vi.fn>;
const mockUpdateDailyReport = updateDailyReport as ReturnType<typeof vi.fn>;
const mockDeleteDailyReport = deleteDailyReport as ReturnType<typeof vi.fn>;
const mockRequireAuth = requireAuth as ReturnType<typeof vi.fn>;

// test user fixtures
const salesUser = {
  id: 12,
  name: '山田太郎',
  email: 'yamada@example.com',
  role: 'SALES' as const,
  departmentId: 3,
};
const managerUser = {
  id: 8,
  name: '佐藤部長',
  email: 'sato@example.com',
  role: 'MANAGER' as const,
  departmentId: 3,
};
const salesUserB = {
  id: 15,
  name: '鈴木花子',
  email: 'suzuki@example.com',
  role: 'SALES' as const,
  departmentId: 5,
};

const baseReportDetail = {
  id: 1001,
  reportDate: '2026-06-04',
  salesperson: { id: 12, name: '山田太郎' },
  status: 'SUBMITTED' as const,
  submittedAt: '2026-06-04T18:30:00',
  problem: 'A社の納期調整が難航している。',
  plan: 'B社へ見積を提出する。',
  visitRecords: [
    {
      id: 5001,
      customer: { id: 30, name: 'ABC商事' },
      visitTime: '10:00',
      visitContent: '提案',
      sortOrder: 1,
    },
  ],
  comments: [
    {
      id: 9001,
      commenter: { id: 8, name: '佐藤部長' },
      content: 'コメント内容',
      createdAt: '2026-06-04T19:00:00',
    },
  ],
  createdAt: '2026-06-04T17:50:00',
  updatedAt: '2026-06-04T18:30:00',
};

function makeContext(id = '1001') {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/v1/daily-reports/1001', {
    method,
    ...(body !== undefined
      ? {
          body: JSON.stringify(body),
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer dummy-token' },
        }
      : { headers: { Authorization: 'Bearer dummy-token' } }),
  });
}

describe('GET /api/v1/daily-reports/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(salesUser);
    mockGetDailyReport.mockResolvedValue(baseReportDetail);
  });

  it('TC-LST-006: 詳細に visitRecords・comments が含まれる → 200', async () => {
    const res = await GET(makeRequest('GET'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe(1001);
    expect(body.visitRecords).toBeDefined();
    expect(Array.isArray(body.visitRecords)).toBe(true);
    expect(body.visitRecords).toHaveLength(1);
    expect(body.visitRecords[0].id).toBe(5001);
    expect(body.comments).toBeDefined();
    expect(Array.isArray(body.comments)).toBe(true);
    expect(body.comments).toHaveLength(1);
    expect(body.comments[0].id).toBe(9001);
  });

  it('TC-LST-007: 参照権限外の日報詳細 → 403', async () => {
    const { ApiError } = await import('@/lib/api');
    mockRequireAuth.mockResolvedValue(salesUserB);
    mockGetDailyReport.mockRejectedValue(new ApiError(403, 'この日報を参照する権限がありません'));

    const res = await GET(makeRequest('GET'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.status).toBe(403);
  });

  it('TC-SEC-003: 他部署 MANAGER が詳細取得 → 403', async () => {
    const { ApiError } = await import('@/lib/api');
    const otherManagerUser = {
      id: 20,
      name: '田中部長',
      email: 'tanaka@example.com',
      role: 'MANAGER' as const,
      departmentId: 99,
    };
    mockRequireAuth.mockResolvedValue(otherManagerUser);
    mockGetDailyReport.mockRejectedValue(new ApiError(403, '他部署の日報を参照できません'));

    const res = await GET(makeRequest('GET'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.message).toBe('他部署の日報を参照できません');
  });

  it('TC-SEC-004: IDOR - SALES が他人の日報IDを直接指定 → 403', async () => {
    const { ApiError } = await import('@/lib/api');
    mockGetDailyReport.mockRejectedValue(new ApiError(403, 'この日報を参照する権限がありません'));

    const res = await GET(makeRequest('GET'), makeContext('9999'));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.status).toBe(403);
  });

  it('正常なレスポンス形状を返す → 200', async () => {
    const res = await GET(makeRequest('GET'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.reportDate).toBe('2026-06-04');
    expect(body.salesperson).toEqual({ id: 12, name: '山田太郎' });
    expect(body.status).toBe('SUBMITTED');
    expect(body.submittedAt).toBe('2026-06-04T18:30:00');
    expect(body.problem).toBe('A社の納期調整が難航している。');
    expect(body.plan).toBe('B社へ見積を提出する。');
  });

  it('存在しない日報 → 404', async () => {
    const { ApiError } = await import('@/lib/api');
    mockGetDailyReport.mockRejectedValue(new ApiError(404, '日報が見つかりません'));

    const res = await GET(makeRequest('GET'), makeContext('9999'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.message).toBe('日報が見つかりません');
  });

  it('未認証 → 401', async () => {
    const { ApiError } = await import('@/lib/api');
    mockRequireAuth.mockRejectedValue(new ApiError(401, '認証が必要です'));

    const res = await GET(makeRequest('GET'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.message).toBe('認証が必要です');
  });

  it('IDが非数値 → 400', async () => {
    const res = await GET(makeRequest('GET'), makeContext('abc'));

    expect(res.status).toBe(400);
  });
});

describe('PUT /api/v1/daily-reports/[id]', () => {
  const validUpdateBody = {
    reportDate: '2026-06-04',
    problem: '課題テスト',
    plan: '予定テスト',
    visitRecords: [{ customerId: 30, visitTime: '10:00', visitContent: '提案', sortOrder: 1 }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(salesUser);
    mockUpdateDailyReport.mockResolvedValue(baseReportDetail);
  });

  it('TC-RPT-007: visitRecords 全置換（3件 → 1件）→ 200、1件のみになる', async () => {
    const bodyWith1Record = {
      reportDate: '2026-06-04',
      visitRecords: [
        { customerId: 30, visitTime: '10:00', visitContent: '提案のみ残す', sortOrder: 1 },
      ],
    };
    const res = await PUT(makeRequest('PUT', bodyWith1Record), makeContext());

    expect(res.status).toBe(200);
    expect(mockUpdateDailyReport).toHaveBeenCalledWith(
      1001,
      12,
      expect.objectContaining({
        visitRecords: expect.arrayContaining([
          expect.objectContaining({ customerId: 30, sortOrder: 1 }),
        ]),
      })
    );
    const callArgs = mockUpdateDailyReport.mock.calls[0][2] as { visitRecords: unknown[] };
    expect(callArgs.visitRecords).toHaveLength(1);
  });

  it('TC-RPT-008: id無し明細の新規追加 → 200（サービスが正しく呼ばれる）', async () => {
    const bodyWithNewRecord = {
      reportDate: '2026-06-04',
      visitRecords: [
        { customerId: 30, visitTime: '10:00', visitContent: '既存の提案', sortOrder: 1 },
        { customerId: 31, visitTime: '14:00', visitContent: '新規追加', sortOrder: 2 },
      ],
    };
    const res = await PUT(makeRequest('PUT', bodyWithNewRecord), makeContext());

    expect(res.status).toBe(200);
    expect(mockUpdateDailyReport).toHaveBeenCalledWith(
      1001,
      12,
      expect.objectContaining({
        visitRecords: expect.arrayContaining([
          expect.objectContaining({ customerId: 31, visitContent: '新規追加' }),
        ]),
      })
    );
  });

  it('TC-RPT-009: 他人の日報更新 → 403', async () => {
    const { ApiError } = await import('@/lib/api');
    mockRequireAuth.mockResolvedValue(salesUserB);
    mockUpdateDailyReport.mockRejectedValue(
      new ApiError(403, 'この日報を更新する権限がありません')
    );

    const res = await PUT(makeRequest('PUT', validUpdateBody), makeContext());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.status).toBe(403);
  });

  it('reportDate 未入力 → 400', async () => {
    const res = await PUT(makeRequest('PUT', { visitRecords: [] }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.fieldErrors).toBeDefined();
    expect(body.fieldErrors.some((e: { field: string }) => e.field === 'reportDate')).toBe(true);
  });

  it('存在しない日報 → 404', async () => {
    const { ApiError } = await import('@/lib/api');
    mockUpdateDailyReport.mockRejectedValue(new ApiError(404, '日報が見つかりません'));

    const res = await PUT(makeRequest('PUT', validUpdateBody), makeContext('9999'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.message).toBe('日報が見つかりません');
  });

  it('未認証 → 401', async () => {
    const { ApiError } = await import('@/lib/api');
    mockRequireAuth.mockRejectedValue(new ApiError(401, '認証が必要です'));

    const res = await PUT(makeRequest('PUT', validUpdateBody), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.message).toBe('認証が必要です');
  });

  it('IDが非数値 → 400', async () => {
    const res = await PUT(makeRequest('PUT', validUpdateBody), makeContext('abc'));

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/v1/daily-reports/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(salesUser);
    mockDeleteDailyReport.mockResolvedValue(undefined);
  });

  it('TC-SUB-005: 提出済み日報の削除 → 400', async () => {
    const { ApiError } = await import('@/lib/api');
    mockDeleteDailyReport.mockRejectedValue(new ApiError(400, '提出済みの日報は削除できません'));

    const res = await DELETE(makeRequest('DELETE'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.message).toBe('提出済みの日報は削除できません');
  });

  it('TC-SUB-006: 下書きの削除 → 204', async () => {
    const res = await DELETE(makeRequest('DELETE'), makeContext());

    expect(res.status).toBe(204);
    expect(mockDeleteDailyReport).toHaveBeenCalledWith(1001, 12);
  });

  it('他人の下書き日報を削除 → 403', async () => {
    const { ApiError } = await import('@/lib/api');
    mockRequireAuth.mockResolvedValue(salesUserB);
    mockDeleteDailyReport.mockRejectedValue(
      new ApiError(403, 'この日報を削除する権限がありません')
    );

    const res = await DELETE(makeRequest('DELETE'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.status).toBe(403);
  });

  it('未認証 → 401', async () => {
    const { ApiError } = await import('@/lib/api');
    mockRequireAuth.mockRejectedValue(new ApiError(401, '認証が必要です'));

    const res = await DELETE(makeRequest('DELETE'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.message).toBe('認証が必要です');
  });

  it('IDが非数値 → 400', async () => {
    const res = await DELETE(makeRequest('DELETE'), makeContext('abc'));

    expect(res.status).toBe(400);
  });
});
