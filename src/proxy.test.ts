// @vitest-environment node
import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { blacklistToken, clearBlacklist } from '@/lib/auth';
import { proxy } from './proxy';

// Clear the in-memory token blacklist before every test to avoid token
// identity collisions (tokens created within the same second share iat
// and will have the same signature if their payload is identical).
beforeEach(() => clearBlacklist());

process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-chars';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

async function makeToken(payload: {
  sub?: string;
  name?: string;
  email?: string;
  role?: string;
  departmentId?: string;
  expiresIn?: string;
}): Promise<string> {
  const {
    sub = '12',
    name = '山田太郎',
    email = 'yamada@example.com',
    role = 'SALES',
    departmentId = '3',
    expiresIn = '1h',
  } = payload;
  const builder = new SignJWT({ sub, name, email, role, departmentId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn);
  return builder.sign(SECRET);
}

function makeRequest(
  path: string,
  options: {
    method?: string;
    token?: string;
    cookie?: string;
    extraHeaders?: Record<string, string>;
  } = {}
): NextRequest {
  const { method = 'GET', token, cookie, extraHeaders = {} } = options;
  const headers: Record<string, string> = { ...extraHeaders };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (cookie) headers['Cookie'] = `access_token=${cookie}`;
  return new NextRequest(`http://localhost${path}`, { method, headers });
}

describe('proxy — auth endpoints (public)', () => {
  it('passes /api/v1/auth/login without a token', async () => {
    const req = makeRequest('/api/v1/auth/login', { method: 'POST' });
    const res = await proxy(req);
    expect(res.status).toBe(200);
  });

  it('passes /api/v1/auth/logout without a token', async () => {
    const req = makeRequest('/api/v1/auth/logout', { method: 'POST' });
    const res = await proxy(req);
    expect(res.status).toBe(200);
  });
});

describe('proxy — unauthenticated requests (TC-SEC-001)', () => {
  it('returns 401 when no token is provided', async () => {
    const req = makeRequest('/api/v1/me');
    const res = await proxy(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 for daily-reports without token', async () => {
    const req = makeRequest('/api/v1/daily-reports');
    const res = await proxy(req);
    expect(res.status).toBe(401);
  });
});

describe('proxy — invalid / expired token (TC-AUTH-005)', () => {
  it('returns 401 for a malformed token', async () => {
    const req = makeRequest('/api/v1/me', { token: 'not.a.valid.jwt' });
    const res = await proxy(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 for an expired token', async () => {
    const token = await makeToken({ expiresIn: '0s' });
    await new Promise((r) => setTimeout(r, 10));
    const req = makeRequest('/api/v1/me', { token });
    const res = await proxy(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 for a blacklisted token', async () => {
    const token = await makeToken({});
    blacklistToken(token);
    const req = makeRequest('/api/v1/me', { token });
    const res = await proxy(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toBe('トークンは無効化されています');
  });
});

describe('proxy — cookie-based token', () => {
  it('passes when token is in access_token cookie', async () => {
    const token = await makeToken({ role: 'ADMIN' });
    const req = makeRequest('/api/v1/me', { cookie: token });
    const res = await proxy(req);
    expect(res.status).toBe(200);
  });

  it('injects Authorization header when token arrives via cookie', async () => {
    const token = await makeToken({ role: 'ADMIN' });
    const req = makeRequest('/api/v1/me', { cookie: token });
    const res = await proxy(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });
});

describe('proxy — valid token passes through and sets headers', () => {
  it('passes /api/v1/me and sets x-user-* headers', async () => {
    const token = await makeToken({ sub: '12', role: 'SALES', departmentId: '3' });
    const req = makeRequest('/api/v1/me', { token });
    const res = await proxy(req);
    expect(res.status).toBe(200);
  });

  it('strips incoming x-user-id to prevent spoofing', async () => {
    const token = await makeToken({ sub: '12', role: 'SALES' });
    const req = makeRequest('/api/v1/me', {
      token,
      extraHeaders: { 'x-user-id': '999' },
    });
    const res = await proxy(req);
    expect(res.status).toBe(200);
  });
});

describe('proxy — RBAC: daily-reports (SALES/MANAGER only)', () => {
  it('allows SALES on GET /api/v1/daily-reports', async () => {
    const token = await makeToken({ role: 'SALES' });
    const req = makeRequest('/api/v1/daily-reports', { token });
    const res = await proxy(req);
    expect(res.status).toBe(200);
  });

  it('allows MANAGER on GET /api/v1/daily-reports', async () => {
    const token = await makeToken({ role: 'MANAGER' });
    const req = makeRequest('/api/v1/daily-reports', { token });
    const res = await proxy(req);
    expect(res.status).toBe(200);
  });

  it('blocks ADMIN on GET /api/v1/daily-reports with 403', async () => {
    const token = await makeToken({ role: 'ADMIN' });
    const req = makeRequest('/api/v1/daily-reports', { token });
    const res = await proxy(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Forbidden');
  });
});

describe('proxy — RBAC: customers', () => {
  it('allows SALES on GET /api/v1/customers', async () => {
    const token = await makeToken({ role: 'SALES' });
    const req = makeRequest('/api/v1/customers', { token });
    const res = await proxy(req);
    expect(res.status).toBe(200);
  });

  it('blocks SALES on POST /api/v1/customers with 403 (TC-SEC-002)', async () => {
    const token = await makeToken({ role: 'SALES' });
    const req = makeRequest('/api/v1/customers', { method: 'POST', token });
    const res = await proxy(req);
    expect(res.status).toBe(403);
  });

  it('blocks MANAGER on DELETE /api/v1/customers/1 with 403', async () => {
    const token = await makeToken({ role: 'MANAGER' });
    const req = makeRequest('/api/v1/customers/1', { method: 'DELETE', token });
    const res = await proxy(req);
    expect(res.status).toBe(403);
  });

  it('allows ADMIN on POST /api/v1/customers', async () => {
    const token = await makeToken({ role: 'ADMIN' });
    const req = makeRequest('/api/v1/customers', { method: 'POST', token });
    const res = await proxy(req);
    expect(res.status).toBe(200);
  });
});

describe('proxy — RBAC: salespersons', () => {
  it('allows any authenticated user on GET /api/v1/salespersons (list)', async () => {
    const token = await makeToken({ role: 'SALES' });
    const req = makeRequest('/api/v1/salespersons', { token });
    const res = await proxy(req);
    expect(res.status).toBe(200);
  });

  it('blocks SALES on GET /api/v1/salespersons/1 (detail) with 403', async () => {
    const token = await makeToken({ role: 'SALES' });
    const req = makeRequest('/api/v1/salespersons/1', { token });
    const res = await proxy(req);
    expect(res.status).toBe(403);
  });

  it('allows ADMIN on POST /api/v1/salespersons', async () => {
    const token = await makeToken({ role: 'ADMIN' });
    const req = makeRequest('/api/v1/salespersons', { method: 'POST', token });
    const res = await proxy(req);
    expect(res.status).toBe(200);
  });
});

describe('proxy — RBAC: departments', () => {
  it('allows any authenticated user on GET /api/v1/departments (list)', async () => {
    const token = await makeToken({ role: 'MANAGER' });
    const req = makeRequest('/api/v1/departments', { token });
    const res = await proxy(req);
    expect(res.status).toBe(200);
  });

  it('blocks SALES on PUT /api/v1/departments/1 with 403', async () => {
    const token = await makeToken({ role: 'SALES' });
    const req = makeRequest('/api/v1/departments/1', { method: 'PUT', token });
    const res = await proxy(req);
    expect(res.status).toBe(403);
  });

  it('allows ADMIN on DELETE /api/v1/departments/1', async () => {
    const token = await makeToken({ role: 'ADMIN' });
    const req = makeRequest('/api/v1/departments/1', { method: 'DELETE', token });
    const res = await proxy(req);
    expect(res.status).toBe(200);
  });
});
