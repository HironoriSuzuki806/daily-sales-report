import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '../src/generated/prisma/client';

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
  const defaultPasswordHash = bcrypt.hashSync('password', 10);
  // 部署（manager は後から設定するため先に作成）
  const managementDept = await prisma.department.upsert({
    where: { id: BigInt(1) },
    update: {},
    create: {
      id: BigInt(1),
      name: '管理部',
      isActive: true,
    },
  });

  const salesHQ = await prisma.department.upsert({
    where: { id: BigInt(2) },
    update: {},
    create: {
      id: BigInt(2),
      name: '営業本部',
      isActive: true,
    },
  });

  const eastSalesDept = await prisma.department.upsert({
    where: { id: BigInt(3) },
    update: {},
    create: {
      id: BigInt(3),
      name: '東日本営業部',
      parentDepartmentId: salesHQ.id,
      isActive: true,
    },
  });

  const westSalesDept = await prisma.department.upsert({
    where: { id: BigInt(4) },
    update: {},
    create: {
      id: BigInt(4),
      name: '西日本営業部',
      parentDepartmentId: salesHQ.id,
      isActive: true,
    },
  });

  // 営業（テスト仕様書のテストユーザー）
  const adminUser = await prisma.salesperson.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      name: '管理者',
      email: 'admin@example.com',
      passwordHash: defaultPasswordHash,
      role: Role.ADMIN,
      departmentId: managementDept.id,
      isActive: true,
    },
  });

  const mgrA = await prisma.salesperson.upsert({
    where: { email: 'mgr_a@example.com' },
    update: {},
    create: {
      name: '佐藤部長',
      email: 'mgr_a@example.com',
      passwordHash: defaultPasswordHash,
      role: Role.MANAGER,
      departmentId: eastSalesDept.id,
      isActive: true,
    },
  });

  const salesA = await prisma.salesperson.upsert({
    where: { email: 'sales_a@example.com' },
    update: {},
    create: {
      name: '山田太郎',
      email: 'sales_a@example.com',
      passwordHash: defaultPasswordHash,
      role: Role.SALES,
      departmentId: eastSalesDept.id,
      isActive: true,
    },
  });

  const salesB = await prisma.salesperson.upsert({
    where: { email: 'sales_b@example.com' },
    update: {},
    create: {
      name: '鈴木花子',
      email: 'sales_b@example.com',
      passwordHash: defaultPasswordHash,
      role: Role.SALES,
      departmentId: westSalesDept.id,
      isActive: true,
    },
  });

  // 部署長を設定
  await prisma.department.update({
    where: { id: eastSalesDept.id },
    data: { managerId: mgrA.id },
  });

  // 顧客マスタ
  const customerA = await prisma.customer.upsert({
    where: { id: BigInt(1) },
    update: {},
    create: {
      id: BigInt(1),
      name: 'ABC商事',
      address: '東京都千代田区丸の内1-1-1',
      phone: '03-1234-5678',
      salesRepId: salesA.id,
      isActive: true,
    },
  });

  await prisma.customer.upsert({
    where: { id: BigInt(2) },
    update: {},
    create: {
      id: BigInt(2),
      name: 'XYZ工業',
      address: '大阪府大阪市北区梅田2-2-2',
      phone: '06-2345-6789',
      salesRepId: salesA.id,
      isActive: true,
    },
  });

  await prisma.customer.upsert({
    where: { id: BigInt(3) },
    update: {},
    create: {
      id: BigInt(3),
      name: '西日本物産',
      address: '福岡県福岡市博多区博多3-3-3',
      phone: '092-3456-7890',
      salesRepId: salesB.id,
      isActive: true,
    },
  });

  // BIGSERIAL シーケンスを最大 ID に合わせてリセット（明示 ID 挿入後の自動採番衝突を防ぐ）
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('departments', 'id'), (SELECT MAX(id) FROM departments))`;
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('customers', 'id'), (SELECT MAX(id) FROM customers))`;

  console.log('Seed data created:', {
    departments: [managementDept.name, salesHQ.name, eastSalesDept.name, westSalesDept.name],
    salespersons: [adminUser.name, mgrA.name, salesA.name, salesB.name],
    customers: [customerA.name, 'XYZ工業', '西日本物産'],
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
