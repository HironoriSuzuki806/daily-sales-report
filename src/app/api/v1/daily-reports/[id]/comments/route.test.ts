// @vitest-environment node
import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { GET, POST } from './route';

vi.mock('@/services/comment.service', () => ({
  listComments: vi.fn(),
  createComment: vi.fn(),
}));

vi.mock('@/lib/api/auth', () => ({
  requireAuth: vi.fn(),
  getCurrentUser: vi.fn(),
  extractBearerToken: vi.fn(),
}));

import { listComments, createComment } from '@/services/comment.service';
import { requireAuth } from '@/lib/api/auth';
const mockListComments = listComments as ReturnType<typeof vi.fn>;
const mockCreateComment = createComment as ReturnType<typeof vi.fn>;
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

const baseComment = {
  id: 9001,
  commenter: { id: 8, name: '佐藤部長' },
  content: 'コメント内容',
  createdAt: '2026-06-04T19:00:00',
};

function makeContext(id = '1001') {
  return { params: Promise.resolve({ id }) };
}

function makeGetRequest(id = '1001') {
  return new NextRequest(`http://localhost/api/v1/daily-reports/${id}/comments`, {
    method: 'GET',
    headers: { Authorization: 'Bearer dummy-token' },
  });
}

function makePostRequest(body?: unknown, id = '1001') {
  return new NextRequest(`http://localhost/api/v1/daily-reports/${id}/comments`, {
    method: 'POST',
    ...(body !== undefined
      ? {
          body: JSON.stringify(body),
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer dummy-token' },
        }
      : { headers: { Authorization: 'Bearer dummy-token' } }),
  });
}

describe('GET /api/v1/daily-reports/[id]/comments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(salesUser);
    mockListComments.mockResolvedValue([baseComment]);
  });

  it('TC-CMT-002: 複数コメントが createdAt 昇順で返る → 200', async () => {
    const earlierComment = {
      id: 9000,
      commenter: { id: 8, name: '佐藤部長' },
      content: '最初のコメント',
      createdAt: '2026-06-04T18:00:00',
    };
    const laterComment = {
      id: 9001,
      commenter: { id: 8, name: '佐藤部長' },
      content: '後のコメント',
      createdAt: '2026-06-04T19:00:00',
    };
    mockListComments.mockResolvedValue([earlierComment, laterComment]);

    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
    expect(body[0].id).toBe(9000);
    expect(body[0].createdAt).toBe('2026-06-04T18:00:00');
    expect(body[1].id).toBe(9001);
    expect(body[1].createdAt).toBe('2026-06-04T19:00:00');
  });

  it('TC-CMT-006: SALES がコメント一覧を取得できる → 200', async () => {
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(mockListComments).toHaveBeenCalledWith(1001, 12, 'SALES', 3);
  });

  it('MANAGER もコメント一覧を取得できる → 200', async () => {
    mockRequireAuth.mockResolvedValue(managerUser);
    mockListComments.mockResolvedValue([baseComment]);

    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(mockListComments).toHaveBeenCalledWith(1001, 8, 'MANAGER', 3);
  });

  it('他のユーザーの日報コメント参照 → 403', async () => {
    const { ApiError } = await import('@/lib/api');
    mockRequireAuth.mockResolvedValue(salesUserB);
    mockListComments.mockRejectedValue(
      new ApiError(403, 'この日報のコメントを参照する権限がありません')
    );

    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.status).toBe(403);
  });

  it('未認証 → 401', async () => {
    const { ApiError } = await import('@/lib/api');
    mockRequireAuth.mockRejectedValue(new ApiError(401, '認証が必要です'));

    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.message).toBe('認証が必要です');
  });

  it('IDが非数値 → 400', async () => {
    const res = await GET(makeGetRequest('abc'), makeContext('abc'));

    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/daily-reports/[id]/comments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(managerUser);
    mockCreateComment.mockResolvedValue(baseComment);
  });

  it('TC-CMT-001: MANAGER のコメント投稿 → 201', async () => {
    const res = await POST(makePostRequest({ content: 'コメント内容' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.id).toBe(9001);
    expect(body.commenter).toEqual({ id: 8, name: '佐藤部長' });
    expect(body.content).toBe('コメント内容');
    expect(mockCreateComment).toHaveBeenCalledWith(1001, 8, 'コメント内容');
  });

  it('TC-CMT-003: SALES のコメント投稿 → 403', async () => {
    mockRequireAuth.mockResolvedValue(salesUser);

    const res = await POST(makePostRequest({ content: 'コメント内容' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.status).toBe(403);
  });

  it('TC-CMT-004: コメント本文未入力 → 400 + fieldError for content', async () => {
    const res = await POST(makePostRequest({ content: '' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.fieldErrors).toBeDefined();
    expect(body.fieldErrors.some((e: { field: string }) => e.field === 'content')).toBe(true);
  });

  it('TC-CMT-005a: 1000文字で投稿 → 201', async () => {
    const longContent = 'a'.repeat(1000);
    const res = await POST(makePostRequest({ content: longContent }), makeContext());

    expect(res.status).toBe(201);
    expect(mockCreateComment).toHaveBeenCalledWith(1001, 8, longContent);
  });

  it('TC-CMT-005b: 1001文字で投稿 → 400', async () => {
    const tooLongContent = 'a'.repeat(1001);
    const res = await POST(makePostRequest({ content: tooLongContent }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.fieldErrors).toBeDefined();
    expect(body.fieldErrors.some((e: { field: string }) => e.field === 'content')).toBe(true);
  });

  it('未認証 → 401', async () => {
    const { ApiError } = await import('@/lib/api');
    mockRequireAuth.mockRejectedValue(new ApiError(401, '認証が必要です'));

    const res = await POST(makePostRequest({ content: 'コメント内容' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.message).toBe('認証が必要です');
  });

  it('IDが非数値 → 400', async () => {
    const res = await POST(makePostRequest({ content: 'コメント内容' }, 'abc'), makeContext('abc'));

    expect(res.status).toBe(400);
  });
});
