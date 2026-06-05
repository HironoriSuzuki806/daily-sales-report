import bcrypt from 'bcryptjs';

import { prisma } from '@/lib/prisma';
import {
  AuthError,
  blacklistToken,
  extractBearerToken,
  getExpiresIn,
  signToken,
  verifyRequestToken,
} from '@/lib/auth';

export type LoginResult = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: {
    id: string;
    name: string;
    role: string;
  };
};

export type MeResult = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: { id: string; name: string } | null;
};

export async function login(email: string, password: string): Promise<LoginResult> {
  const salesperson = await prisma.salesperson.findUnique({
    where: { email },
  });

  if (!salesperson || !salesperson.isActive) {
    throw new AuthError('メールアドレスまたはパスワードが正しくありません');
  }

  const passwordMatch = await bcrypt.compare(password, salesperson.passwordHash);
  if (!passwordMatch) {
    throw new AuthError('メールアドレスまたはパスワードが正しくありません');
  }

  const accessToken = await signToken({
    sub: salesperson.id.toString(),
    name: salesperson.name,
    email: salesperson.email,
    role: salesperson.role,
    departmentId: (salesperson.departmentId ?? BigInt(0)).toString(),
  });

  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn: getExpiresIn(),
    user: {
      id: salesperson.id.toString(),
      name: salesperson.name,
      role: salesperson.role,
    },
  };
}

export async function logout(request: Request): Promise<void> {
  const authHeader = request.headers.get('Authorization');
  const token = extractBearerToken(authHeader);
  if (token) {
    blacklistToken(token);
  }
}

export async function getMe(request: Request): Promise<MeResult> {
  const payload = await verifyRequestToken(request);

  const salesperson = await prisma.salesperson.findUnique({
    where: { id: BigInt(payload.sub) },
    include: { department: true },
  });

  if (!salesperson || !salesperson.isActive) {
    throw new AuthError('ユーザーが見つかりません');
  }

  return {
    id: salesperson.id.toString(),
    name: salesperson.name,
    email: salesperson.email,
    role: salesperson.role,
    department: salesperson.department
      ? {
          id: salesperson.department.id.toString(),
          name: salesperson.department.name,
        }
      : null,
  };
}
