import { PrismaClient } from '@/generated/prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// PrismaClient の型定義では adapter または accelerateUrl が必須だが、
// DATABASE_URL 環境変数を使った通常接続でも動作するため型アサーションを使用する
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createPrismaClient = () =>
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  } as any);

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
