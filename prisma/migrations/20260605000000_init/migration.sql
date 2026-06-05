-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SALES', 'MANAGER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateTable
CREATE TABLE "departments" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "parentDepartmentId" BIGINT,
    "managerId" BIGINT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salespersons" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role" "Role" NOT NULL,
    "departmentId" BIGINT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salespersons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "address" VARCHAR(255),
    "phone" VARCHAR(20),
    "salesRepId" BIGINT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_reports" (
    "id" BIGSERIAL NOT NULL,
    "salespersonId" BIGINT NOT NULL,
    "reportDate" DATE NOT NULL,
    "problem" TEXT,
    "plan" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_records" (
    "id" BIGSERIAL NOT NULL,
    "dailyReportId" BIGINT NOT NULL,
    "customerId" BIGINT,
    "visitContent" TEXT,
    "visitTime" VARCHAR(5),
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visit_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" BIGSERIAL NOT NULL,
    "dailyReportId" BIGINT NOT NULL,
    "commenterId" BIGINT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "departments_parentDepartmentId_idx" ON "departments"("parentDepartmentId");

-- CreateIndex
CREATE INDEX "departments_managerId_idx" ON "departments"("managerId");

-- CreateIndex
CREATE UNIQUE INDEX "salespersons_email_key" ON "salespersons"("email");

-- CreateIndex
CREATE INDEX "salespersons_departmentId_idx" ON "salespersons"("departmentId");

-- CreateIndex
CREATE INDEX "customers_salesRepId_idx" ON "customers"("salesRepId");

-- CreateIndex
CREATE INDEX "daily_reports_salespersonId_idx" ON "daily_reports"("salespersonId");

-- CreateIndex
CREATE INDEX "daily_reports_reportDate_idx" ON "daily_reports"("reportDate");

-- CreateIndex
CREATE INDEX "daily_reports_status_idx" ON "daily_reports"("status");

-- CreateIndex
CREATE UNIQUE INDEX "daily_reports_salespersonId_reportDate_key" ON "daily_reports"("salespersonId", "reportDate");

-- CreateIndex
CREATE INDEX "visit_records_dailyReportId_idx" ON "visit_records"("dailyReportId");

-- CreateIndex
CREATE INDEX "visit_records_customerId_idx" ON "visit_records"("customerId");

-- CreateIndex
CREATE INDEX "comments_dailyReportId_idx" ON "comments"("dailyReportId");

-- CreateIndex
CREATE INDEX "comments_commenterId_idx" ON "comments"("commenterId");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parentDepartmentId_fkey" FOREIGN KEY ("parentDepartmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "salespersons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salespersons" ADD CONSTRAINT "salespersons_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "salespersons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "salespersons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_records" ADD CONSTRAINT "visit_records_dailyReportId_fkey" FOREIGN KEY ("dailyReportId") REFERENCES "daily_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_records" ADD CONSTRAINT "visit_records_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_dailyReportId_fkey" FOREIGN KEY ("dailyReportId") REFERENCES "daily_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_commenterId_fkey" FOREIGN KEY ("commenterId") REFERENCES "salespersons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
