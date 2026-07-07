-- CreateEnum
CREATE TYPE "DeletionType" AS ENUM ('SOFT', 'PERMANENT');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "blockReason" TEXT,
ADD COLUMN     "blockedAt" TIMESTAMP(3),
ADD COLUMN     "blockedUntil" TIMESTAMP(3),
ADD COLUMN     "canReactivate" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletionType" "DeletionType",
ADD COLUMN     "reactivateWithin" TIMESTAMP(3);
