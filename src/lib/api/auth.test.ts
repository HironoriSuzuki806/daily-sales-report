// @vitest-environment node
import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { blacklistToken, clearBlacklist } from '@/lib/auth';
import { getCurrentUser, requireAuth, extractBearerToken } from './auth';

process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-chars';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

async function makeToken(
  overrides: {
    sub?: string;
    name?: string;
    email?: string;
    role?: string;
    departmentId?: string;
    expiresIn?: string;
  } = {}
): Promise<string> {
  const {
    sub = '12',
    name = '山田太郎',
    email = 'yamada@example.com',
    role = 'SALES',
    departmentId = '3',
    expiresIn = '1h',
  } = overrides;
  return new SignJWT({ sub, name, email, role, departmentId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(SECRET);
}

function makeRequest(
  options: {
    bearerToken?: string;
    cookieToken?: string;
    proxyHeaders?: Record<string, string>;
  } = {}
): NextRequest {
  const { bearerToken, cookieToken, proxyHeaders = {} } = options;
  const headers: Record<string, string> = { ...proxyHeaders };
  if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;
  if (cookieToken) headers['Cookie'] = `access_token=${cookieToken}`;
  return new NextRequest('http://localhost/api/v1/test', { headers });
}

const expectedUser = {
  id: 12,
  name: '山田太郎',
  email: 'yamada@example.com',
  role: 'SALES',
  departmentId: 3,
};

beforeEach(() => clearBlacklist());

// ─── extractBearerToken ───────────────────────────────────────────────────────

describe('extractBearerToken', () => {
  it('extracts token from Authorization header', () => {
    const req = makeRequest({ bearerToken: 'my-token' });
    expect(extractBearerToken(req)).toBe('my-token');
  });

  it('returns null when no Authorization header', () => {
    const req = makeRequest();
    expect(extractBearerToken(req)).toBeNull();
  });
});

// ─── requireAuth ─────────────────────────────────────────────────────────────

describe('requireAuth', () => {
  it('returns user when valid Bearer token in Authorization header', async () => {
    const token = await makeToken();
    const req = makeRequest({ bearerToken: token });
    const user = await requireAuth(req);
    expect(user).toMatchObject(expectedUser);
  });

  it('returns user when valid token in session cookie (browser form fallback)', async () => {
    const token = await makeToken();
    const req = makeRequest({ cookieToken: token });
    const user = await requireAuth(req);
    expect(user).toMatchObject(expectedUser);
  });

  it('prefers Authorization header over cookie when both are present', async () => {
    const headerToken = await makeToken({ sub: '99', name: 'ヘッダユーザー' });
    const cookieToken = await makeToken({ sub: '12', name: '山田太郎' });
    const req = makeRequest({ bearerToken: headerToken, cookieToken: cookieToken });
    const user = await requireAuth(req);
    expect(user.id).toBe(99);
    expect(user.name).toBe('ヘッダユーザー');
  });

  it('throws 401 when no token is provided', async () => {
    const req = makeRequest();
    await expect(requireAuth(req)).rejects.toMatchObject({ status: 401 });
  });

  it('throws 401 when Bearer token is blacklisted', async () => {
    const token = await makeToken();
    blacklistToken(token);
    const req = makeRequest({ bearerToken: token });
    await expect(requireAuth(req)).rejects.toMatchObject({ status: 401 });
  });

  it('throws 401 when cookie token is blacklisted', async () => {
    const token = await makeToken();
    blacklistToken(token);
    const req = makeRequest({ cookieToken: token });
    await expect(requireAuth(req)).rejects.toMatchObject({ status: 401 });
  });

  it('throws 401 when token is expired', async () => {
    const token = await makeToken({ expiresIn: '0s' });
    const req = makeRequest({ bearerToken: token });
    await expect(requireAuth(req)).rejects.toMatchObject({ status: 401 });
  });

  it('returns user from proxy headers when present (skips token check)', async () => {
    const req = makeRequest({
      proxyHeaders: {
        'x-user-id': '99',
        'x-user-name': encodeURIComponent('プロキシユーザー'),
        'x-user-email': 'proxy@example.com',
        'x-user-role': 'ADMIN',
      },
    });
    const user = await requireAuth(req);
    expect(user).toMatchObject({ id: 99, role: 'ADMIN', email: 'proxy@example.com' });
  });

  it('maps departmentId to null when not present in token', async () => {
    const token = await makeToken({ departmentId: undefined });
    // Re-sign without departmentId using raw SignJWT
    const rawToken = await new SignJWT({
      sub: '12',
      name: '山田太郎',
      email: 'yamada@example.com',
      role: 'ADMIN',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(SECRET);
    const req = makeRequest({ bearerToken: rawToken });
    const user = await requireAuth(req);
    expect(user.departmentId).toBeNull();
  });
});

// ─── getCurrentUser ───────────────────────────────────────────────────────────

describe('getCurrentUser', () => {
  it('returns user when valid Bearer token', async () => {
    const token = await makeToken();
    const req = makeRequest({ bearerToken: token });
    const user = await getCurrentUser(req);
    expect(user).toMatchObject(expectedUser);
  });

  it('returns user when valid session cookie token', async () => {
    const token = await makeToken();
    const req = makeRequest({ cookieToken: token });
    const user = await getCurrentUser(req);
    expect(user).toMatchObject(expectedUser);
  });

  it('returns null when no token', async () => {
    const req = makeRequest();
    const user = await getCurrentUser(req);
    expect(user).toBeNull();
  });

  it('returns null when token is blacklisted', async () => {
    const token = await makeToken();
    blacklistToken(token);
    const req = makeRequest({ cookieToken: token });
    const user = await getCurrentUser(req);
    expect(user).toBeNull();
  });

  it('returns null when token is invalid', async () => {
    const req = makeRequest({ bearerToken: 'not-a-valid-jwt' });
    const user = await getCurrentUser(req);
    expect(user).toBeNull();
  });
});
