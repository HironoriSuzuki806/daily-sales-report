// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';

import {
  signToken,
  verifyToken,
  blacklistToken,
  clearBlacklist,
  isTokenBlacklisted,
  extractBearerToken,
  verifyRequestToken,
  AuthError,
} from './auth';

// JWT_SECRET が必要なため環境変数を設定
process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-chars';
process.env.JWT_EXPIRES_IN = '3600';

describe('extractBearerToken', () => {
  it('有効な Bearer トークンを抽出できる', () => {
    const token = extractBearerToken('Bearer abc123');
    expect(token).toBe('abc123');
  });

  it('ヘッダーが null の場合は null を返す', () => {
    expect(extractBearerToken(null)).toBeNull();
  });

  it('Bearer プレフィックスがない場合は null を返す', () => {
    expect(extractBearerToken('Basic abc123')).toBeNull();
  });

  it('空文字の場合は null を返す', () => {
    expect(extractBearerToken('')).toBeNull();
  });
});

describe('signToken / verifyToken', () => {
  it('トークンの署名と検証が正常に動作する', async () => {
    const payload = {
      sub: '12',
      name: '山田太郎',
      email: 'yamada@example.com',
      role: 'SALES' as const,
      departmentId: '3',
    };

    const token = await signToken(payload);
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');

    const verified = await verifyToken(token);
    expect(verified.sub).toBe('12');
    expect(verified.name).toBe('山田太郎');
    expect(verified.email).toBe('yamada@example.com');
    expect(verified.role).toBe('SALES');
    expect(verified.departmentId).toBe('3');
  });

  it('不正なトークンは検証に失敗する', async () => {
    await expect(verifyToken('invalid.token.here')).rejects.toThrow();
  });

  it('改ざんされたトークンは検証に失敗する', async () => {
    const token = await signToken({
      sub: '12',
      name: '山田太郎',
      email: 'yamada@example.com',
      role: 'SALES' as const,
      departmentId: '3',
    });
    const tampered = token.slice(0, -5) + 'xxxxx';
    await expect(verifyToken(tampered)).rejects.toThrow();
  });
});

describe('トークンブラックリスト', () => {
  beforeEach(() => {
    clearBlacklist();
  });

  it('ブラックリストに追加されていないトークンは無効でない', async () => {
    const token = await signToken({
      sub: '99',
      name: 'テスト',
      email: 'test@example.com',
      role: 'SALES' as const,
      departmentId: '1',
    });
    expect(isTokenBlacklisted(token)).toBe(false);
  });

  it('ブラックリストに追加されたトークンは無効になる', async () => {
    const token = await signToken({
      sub: '100',
      name: 'テスト2',
      email: 'test2@example.com',
      role: 'SALES' as const,
      departmentId: '1',
    });
    blacklistToken(token);
    expect(isTokenBlacklisted(token)).toBe(true);
  });
});

describe('verifyRequestToken', () => {
  beforeEach(() => {
    clearBlacklist();
  });

  it('有効なトークンを持つリクエストは検証に成功する', async () => {
    const token = await signToken({
      sub: '12',
      name: '山田太郎',
      email: 'yamada@example.com',
      role: 'SALES' as const,
      departmentId: '3',
    });

    const request = new Request('http://localhost/api/test', {
      headers: { Authorization: `Bearer ${token}` },
    });

    const payload = await verifyRequestToken(request);
    expect(payload.sub).toBe('12');
  });

  it('Authorization ヘッダーがないリクエストは AuthError をスローする', async () => {
    const request = new Request('http://localhost/api/test');
    await expect(verifyRequestToken(request)).rejects.toThrow(AuthError);
  });

  it('ブラックリスト済みトークンは AuthError をスローする', async () => {
    const token = await signToken({
      sub: '200',
      name: 'ブラックリスト',
      email: 'blacklist@example.com',
      role: 'SALES' as const,
      departmentId: '1',
    });
    blacklistToken(token);

    const request = new Request('http://localhost/api/test', {
      headers: { Authorization: `Bearer ${token}` },
    });
    await expect(verifyRequestToken(request)).rejects.toThrow(AuthError);
  });

  it('不正なトークンは AuthError をスローする', async () => {
    const request = new Request('http://localhost/api/test', {
      headers: { Authorization: 'Bearer invalid-token' },
    });
    await expect(verifyRequestToken(request)).rejects.toThrow(AuthError);
  });
});
