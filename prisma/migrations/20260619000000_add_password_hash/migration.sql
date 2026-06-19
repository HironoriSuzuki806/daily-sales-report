-- AlterTable: add passwordHash column to salespersons
ALTER TABLE "salespersons" ADD COLUMN "passwordHash" VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE "salespersons" ALTER COLUMN "passwordHash" DROP DEFAULT;
