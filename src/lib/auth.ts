import { SignJWT, jwtVerify } from 'jose';

import type { Role } from '@/generated/prisma/enums';

export type JwtPayload = {
  sub: string; // salesperson id (string representation of BigInt)
  name: string;
  role: Role;
};

/**
 * In-memory token blacklist for logout.
 * In production this should be replaced with Redis or a database.
 */
const tokenBlacklist = new Set<string>();

function getJwtSecret(): Uint8Array {
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
  return payload as unknown as JwtPayload;
}

export function blacklistToken(token: string): void {
  tokenBlacklist.add(token);
}

export function isTokenBlacklisted(token: string): boolean {
  return tokenBlacklist.has(token);
}

/**
 * Extracts the Bearer token from the Authorization header.
 * Returns null if the header is missing or malformed.
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Verifies the JWT from a Request's Authorization header.
 * Throws an error if the token is missing, blacklisted, or invalid.
 */
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
