// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';

import { AuthError } from '@/lib/auth';
import { login, logout, getMe } from './auth.service';

// 環境変数設定
process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-chars';
process.env.JWT_EXPIRES_IN = '3600';

// Prisma をモック
vi.mock('@/lib/prisma', () => ({
  prisma: {
    salesperson: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';

const mockPrisma = prisma as unknown as {
  salesperson: {
    findUnique: ReturnType<typeof vi.fn>;
  };
};

describe('login', () => {
  const hashedPassword = bcrypt.hashSync('correct-password', 10);

  const mockSalesperson = {
    id: BigInt(12),
    name: '山田太郎',
    email: 'yamada@example.com',
    passwordHash: hashedPassword,
    role: 'SALES' as const,
    departmentId: BigInt(3),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    department: {
      id: BigInt(3),
      name: '東日本営業部',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC-AUTH-001: 正しい資格情報でログインできる', async () => {
    mockPrisma.salesperson.findUnique.mockResolvedValue(mockSalesperson);

    const result = await login('yamada@example.com', 'correct-password');

    expect(result).toMatchObject({
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: {
        id: '12',
        name: '山田太郎',
        role: 'SALES',
      },
    });
    expect(result.accessToken).toBeTruthy();
  });

  it('TC-AUTH-002: パスワード誤りは AuthError をスローする', async () => {
    mockPrisma.salesperson.findUnique.mockResolvedValue(mockSalesperson);

    await expect(login('yamada@example.com', 'wrong-password')).rejects.toThrow(AuthError);
  });

  it('TC-AUTH-003: 未登録メールは AuthError をスローする', async () => {
    mockPrisma.salesperson.findUnique.mockResolvedValue(null);

    await expect(login('notfound@example.com', 'any-password')).rejects.toThrow(AuthError);
  });

  it('無効化されたユーザー(isActive=false)はログインできない', async () => {
    mockPrisma.salesperson.findUnique.mockResolvedValue({
      ...mockSalesperson,
      isActive: false,
    });

    await expect(login('yamada@example.com', 'correct-password')).rejects.toThrow(AuthError);
  });

  it('ユーザーが存在しない場合もパスワード誤りと同じエラーを返す（情報漏洩防止）', async () => {
    mockPrisma.salesperson.findUnique.mockResolvedValue(null);

    let notFoundError: Error | undefined;
    try {
      await login('notfound@example.com', 'any-password');
    } catch (e) {
      notFoundError = e as Error;
    }

    mockPrisma.salesperson.findUnique.mockResolvedValue(mockSalesperson);

    let wrongPassError: Error | undefined;
    try {
      await login('yamada@example.com', 'wrong-password');
    } catch (e) {
      wrongPassError = e as Error;
    }

    expect(notFoundError?.message).toBe(wrongPassError?.message);
  });
});

describe('logout', () => {
  it('TC-AUTH-006: ログアウトが正常に完了する（トークンをブラックリストに追加）', async () => {
    // signToken を使って有効なトークンを生成
    const { signToken } = await import('@/lib/auth');
    const token = await signToken({
      sub: '12',
      name: '山田太郎',
      email: 'yamada@example.com',
      role: 'SALES' as const,
      departmentId: '3',
    });

    const request = new Request('http://localhost/api/v1/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    // logout はエラーなく完了する
    await expect(logout(request)).resolves.toBeUndefined();

    // ブラックリストに追加されている
    const { isTokenBlacklisted } = await import('@/lib/auth');
    expect(isTokenBlacklisted(token)).toBe(true);
  });

  it('Authorization ヘッダーなしでもエラーなく完了する', async () => {
    const request = new Request('http://localhost/api/v1/auth/logout', {
      method: 'POST',
    });
    await expect(logout(request)).resolves.toBeUndefined();
  });
});

describe('getMe', () => {
  const mockSalesperson = {
    id: BigInt(12),
    name: '山田太郎',
    email: 'yamada@example.com',
    passwordHash: 'hashed',
    role: 'SALES' as const,
    departmentId: BigInt(3),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    department: {
      id: BigInt(3),
      name: '東日本営業部',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('有効なトークンでユーザー情報を取得できる', async () => {
    const { signToken } = await import('@/lib/auth');
    // logout テストとは異なる sub を使いブラックリストの影響を避ける
    const token = await signToken({
      sub: '42',
      name: '山田太郎',
      email: 'yamada@example.com',
      role: 'SALES' as const,
      departmentId: '3',
    });

    mockPrisma.salesperson.findUnique.mockResolvedValue(mockSalesperson);

    const request = new Request('http://localhost/api/v1/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    const result = await getMe(request);

    expect(result).toEqual({
      id: '12',
      name: '山田太郎',
      email: 'yamada@example.com',
      role: 'SALES',
      department: { id: '3', name: '東日本営業部' },
    });
  });

  it('TC-AUTH-005: 無効なトークンは AuthError をスローする', async () => {
    const request = new Request('http://localhost/api/v1/me', {
      headers: { Authorization: 'Bearer invalid.jwt.token' },
    });

    await expect(getMe(request)).rejects.toThrow(AuthError);
  });

  it('ユーザーが存在しない場合は AuthError をスローする', async () => {
    const { signToken } = await import('@/lib/auth');
    const token = await signToken({
      sub: '999',
      name: 'ゴースト',
      email: 'ghost@example.com',
      role: 'SALES' as const,
      departmentId: '0',
    });

    mockPrisma.salesperson.findUnique.mockResolvedValue(null);

    const request = new Request('http://localhost/api/v1/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    await expect(getMe(request)).rejects.toThrow(AuthError);
  });

  it('部署なしのユーザーは department が null になる', async () => {
    const { signToken } = await import('@/lib/auth');
    const token = await signToken({
      sub: '13',
      name: '田中一郎',
      email: 'tanaka@example.com',
      role: 'ADMIN' as const,
      departmentId: '0',
    });

    mockPrisma.salesperson.findUnique.mockResolvedValue({
      ...mockSalesperson,
      id: BigInt(13),
      name: '田中一郎',
      email: 'tanaka@example.com',
      role: 'ADMIN' as const,
      department: null,
    });

    const request = new Request('http://localhost/api/v1/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    const result = await getMe(request);
    expect(result.department).toBeNull();
  });
});
