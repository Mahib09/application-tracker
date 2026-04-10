-- CreateEnum
CREATE TYPE "changeTrigger" AS ENUM ('MANUAL', 'SYNC', 'AUTO_GHOST', 'DRAG_DROP', 'COMMAND_PALETTE');

-- CreateTable
CREATE TABLE "StatusChange" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "applicationId" UUID NOT NULL,
    "fromStatus" "applicationStatus" NOT NULL,
    "toStatus" "applicationStatus" NOT NULL,
    "trigger" "changeTrigger" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StatusChange_applicationId_createdAt_idx" ON "StatusChange"("applicationId", "createdAt");

-- AddForeignKey
ALTER TABLE "StatusChange" ADD CONSTRAINT "StatusChange_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
