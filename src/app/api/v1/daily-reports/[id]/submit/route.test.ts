// @vitest-environment node
import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { POST } from './route';

vi.mock('@/services/daily-report.service', () => ({
  submitDailyReport: vi.fn(),
}));

vi.mock('@/lib/api/auth', () => ({
  requireAuth: vi.fn(),
  getCurrentUser: vi.fn(),
  extractBearerToken: vi.fn(),
}));

import { submitDailyReport } from '@/services/daily-report.service';
import { requireAuth } from '@/lib/api/auth';
const mockSubmitDailyReport = submitDailyReport as ReturnType<typeof vi.fn>;
const mockRequireAuth = requireAuth as ReturnType<typeof vi.fn>;

// test user fixtures
const salesUser = {
  id: 12,
  name: '山田太郎',
  email: 'yamada@example.com',
  role: 'SALES' as const,
  departmentId: 3,
};
const salesUserB = {
  id: 15,
  name: '鈴木花子',
  email: 'suzuki@example.com',
  role: 'SALES' as const,
  departmentId: 5,
};

const submittedReport = {
  id: 1001,
  reportDate: '2026-06-04',
  salesperson: { id: 12, name: '山田太郎' },
  status: 'SUBMITTED' as const,
  submittedAt: '2026-06-04T18:30:00',
  problem: null,
  plan: null,
  visitRecords: [
    {
      id: 5001,
      customer: { id: 30, name: 'ABC商事' },
      visitTime: '10:00',
      visitContent: '提案',
      sortOrder: 1,
    },
  ],
  comments: [],
  createdAt: '2026-06-04T17:50:00',
  updatedAt: '2026-06-04T18:30:00',
};

function makeContext(id = '1001') {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(id = '1001') {
  return new NextRequest(`http://localhost/api/v1/daily-reports/${id}/submit`, {
    method: 'POST',
    headers: { Authorization: 'Bearer dummy-token' },
  });
}

describe('POST /api/v1/daily-reports/[id]/submit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(salesUser);
    mockSubmitDailyReport.mockResolvedValue(submittedReport);
  });

  it('TC-SUB-001: 正常提出 → 200、status=SUBMITTED、submittedAt が記録される', async () => {
    const res = await POST(makeRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe(1001);
    expect(body.status).toBe('SUBMITTED');
    expect(body.submittedAt).toBe('2026-06-04T18:30:00');
    expect(mockSubmitDailyReport).toHaveBeenCalledWith(1001, 12);
  });

  it('TC-SUB-002: 訪問記録0件で提出 → 400', async () => {
    const { ApiError } = await import('@/lib/api');
    mockSubmitDailyReport.mockRejectedValue(new ApiError(400, '提出には訪問記録が1件以上必要です'));

    const res = await POST(makeRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.message).toBe('提出には訪問記録が1件以上必要です');
  });

  it('TC-SUB-003: 顧客未選択で提出 → 400', async () => {
    const { ApiError } = await import('@/lib/api');
    mockSubmitDailyReport.mockRejectedValue(
      new ApiError(400, '訪問記録に顧客が設定されていない行があります')
    );

    const res = await POST(makeRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.message).toBe('訪問記録に顧客が設定されていない行があります');
  });

  it('TC-SUB-004: 訪問内容未入力で提出 → 400', async () => {
    const { ApiError } = await import('@/lib/api');
    mockSubmitDailyReport.mockRejectedValue(
      new ApiError(400, '訪問記録に訪問内容が入力されていない行があります')
    );

    const res = await POST(makeRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.message).toBe('訪問記録に訪問内容が入力されていない行があります');
  });

  it('他人の日報の提出 → 403', async () => {
    const { ApiError } = await import('@/lib/api');
    mockRequireAuth.mockResolvedValue(salesUserB);
    mockSubmitDailyReport.mockRejectedValue(
      new ApiError(403, 'この日報を提出する権限がありません')
    );

    const res = await POST(makeRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.status).toBe(403);
  });

  it('存在しない日報 → 404', async () => {
    const { ApiError } = await import('@/lib/api');
    mockSubmitDailyReport.mockRejectedValue(new ApiError(404, '日報が見つかりません'));

    const res = await POST(makeRequest('9999'), makeContext('9999'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.message).toBe('日報が見つかりません');
  });

  it('未認証 → 401', async () => {
    const { ApiError } = await import('@/lib/api');
    mockRequireAuth.mockRejectedValue(new ApiError(401, '認証が必要です'));

    const res = await POST(makeRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.message).toBe('認証が必要です');
  });

  it('IDが非数値 → 400', async () => {
    const res = await POST(makeRequest('abc'), makeContext('abc'));

    expect(res.status).toBe(400);
  });
});
