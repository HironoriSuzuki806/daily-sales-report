import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';

import type { Role } from '@/generated/prisma/enums';

export type JwtPayload = {
  sub: string; // salesperson id (string representation of BigInt)
  name: string;
  email: string;
  role: Role;
  departmentId?: string; // undefined when user has no department (e.g. ADMIN)
};

const JwtPayloadSchema = z.object({
  sub: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(['SALES', 'MANAGER', 'ADMIN']),
  departmentId: z.string().optional(),
});

// TODO: Replace with Redis or DB-backed store before production deployment.
// Cloud Run restarts on deploy/cold-start, causing logged-out tokens to become
// valid again. Track in Issue for blacklist persistence implementation.
const tokenBlacklist = new Set<string>();

// TODO: Add TTL-based cleanup to prevent unbounded memory growth.
// Currently expired tokens accumulate indefinitely. Consider recording expiry
// timestamps at blacklist time and purging on a periodic interval.

export function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return new TextEncoder().encode(secret);
}

export function getExpiresIn(): number {
  return parseInt(process.env.JWT_EXPIRES_IN ?? '3600', 10);
}

export async function signToken(payload: JwtPayload): Promise<string> {
  const secret = getJwtSecret();
  const expiresIn = getExpiresIn();

  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresIn)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const secret = getJwtSecret();
  const { payload } = await jwtVerify(token, secret);
  return JwtPayloadSchema.parse(payload);
}

export function blacklistToken(token: string): void {
  tokenBlacklist.add(token);
}

export function isTokenBlacklisted(token: string): boolean {
  return tokenBlacklist.has(token);
}

/** For use in tests only — clears the in-memory blacklist between test cases. */
export function clearBlacklist(): void {
  tokenBlacklist.clear();
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

export async function verifyRequestToken(request: Request): Promise<JwtPayload> {
  const authHeader = request.headers.get('Authorization');
  const token = extractBearerToken(authHeader);

  if (!token) {
    throw new AuthError('トークンが提供されていません');
  }

  if (isTokenBlacklisted(token)) {
    throw new AuthError('トークンは無効化されています');
  }

  try {
    return await verifyToken(token);
  } catch {
    throw new AuthError('トークンが無効または期限切れです');
  }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}
