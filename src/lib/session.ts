/**
 * Server-side session helpers.
 *
 * The JWT access token is stored in an HTTP-only cookie (`access_token`) so
 * that Server Components and middleware can read the authenticated user without
 * requiring client-side JavaScript. The login route sets this cookie; the
 * logout route clears it.
 */

import { cookies } from 'next/headers';

import { isTokenBlacklisted, verifyToken, type JwtPayload } from '@/lib/auth';

export const ACCESS_TOKEN_COOKIE = 'access_token';

/** Cookie options shared between set and delete operations. */
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NEXT_PUBLIC_APP_URL
    ? process.env.NEXT_PUBLIC_APP_URL.startsWith('https://')
    : process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: parseInt(process.env.JWT_EXPIRES_IN ?? '3600', 10),
};

/**
 * Persist the JWT access token in an HTTP-only cookie.
 * Call this from the login Server Action or API route after a successful login.
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_TOKEN_COOKIE, token, cookieOptions);
}

/**
 * Remove the session cookie.
 * Call this from the logout Server Action or API route.
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_TOKEN_COOKIE);
}

/**
 * Read and verify the session cookie, returning the decoded JWT payload.
 * Returns `null` when there is no cookie or the token is invalid/expired.
 */
export async function getSessionUser(): Promise<JwtPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return null;
  if (isTokenBlacklisted(token)) return null;

  try {
    return await verifyToken(token);
  } catch {
    return null;
  }
}
