-- AlterTable Application: add confidence, manuallyEdited, sourceEmailId
ALTER TABLE "Application" ADD COLUMN "confidence" DOUBLE PRECISION;
ALTER TABLE "Application" ADD COLUMN "manuallyEdited" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Application" ADD COLUMN "sourceEmailId" TEXT;

-- AlterTable SyncState: add sync metrics
ALTER TABLE "SyncState" ADD COLUMN "emailsFetched" INTEGER;
ALTER TABLE "SyncState" ADD COLUMN "emailsClassified" INTEGER;
ALTER TABLE "SyncState" ADD COLUMN "aiCallCount" INTEGER;
ALTER TABLE "SyncState" ADD COLUMN "sonnetCallCount" INTEGER;
