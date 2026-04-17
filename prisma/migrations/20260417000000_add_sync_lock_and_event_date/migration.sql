-- AlterEnum
ALTER TYPE "lastSyncStatus" ADD VALUE 'IN_PROGRESS';

-- AlterTable
ALTER TABLE "StatusChange" ADD COLUMN "eventDate" TIMESTAMP(3);
