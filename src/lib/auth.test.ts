// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';

import {
  signToken,
  verifyToken,
  blacklistToken,
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
      role: 'SALES' as const,
    };

    const token = await signToken(payload);
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');

    const verified = await verifyToken(token);
    expect(verified.sub).toBe('12');
    expect(verified.name).toBe('山田太郎');
    expect(verified.role).toBe('SALES');
  });

  it('不正なトークンは検証に失敗する', async () => {
    await expect(verifyToken('invalid.token.here')).rejects.toThrow();
  });

  it('改ざんされたトークンは検証に失敗する', async () => {
    const token = await signToken({
      sub: '12',
      name: '山田太郎',
      role: 'SALES' as const,
    });
    const tampered = token.slice(0, -5) + 'xxxxx';
    await expect(verifyToken(tampered)).rejects.toThrow();
  });
});

describe('トークンブラックリスト', () => {
  beforeEach(() => {
    // 各テスト前にブラックリストの状態をリセットするため
    // 別のトークンを使用してテストを独立させる
  });

  it('ブラックリストに追加されていないトークンは無効でない', async () => {
    const token = await signToken({
      sub: '99',
      name: 'テスト',
      role: 'SALES' as const,
    });
    expect(isTokenBlacklisted(token)).toBe(false);
  });

  it('ブラックリストに追加されたトークンは無効になる', async () => {
    const token = await signToken({
      sub: '100',
      name: 'テスト2',
      role: 'SALES' as const,
    });
    blacklistToken(token);
    expect(isTokenBlacklisted(token)).toBe(true);
  });
});

describe('verifyRequestToken', () => {
  it('有効なトークンを持つリクエストは検証に成功する', async () => {
    const token = await signToken({
      sub: '12',
      name: '山田太郎',
      role: 'SALES' as const,
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
      role: 'SALES' as const,
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
