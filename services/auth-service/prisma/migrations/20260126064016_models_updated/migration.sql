/*
  Warnings:

  - You are about to drop the column `isVerified` on the `credentials` table. All the data in the column will be lost.
  - The `role` column on the `credentials` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "DeletionType" AS ENUM ('SOFT', 'PERMANENT');

-- CreateEnum
CREATE TYPE "UserRoles" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'VENDOR', 'CUSTOMER');

-- AlterTable
ALTER TABLE "credentials" DROP COLUMN "isVerified",
ADD COLUMN     "blockReason" TEXT,
ADD COLUMN     "blockedAt" TIMESTAMP(3),
ADD COLUMN     "blockedUntil" TIMESTAMP(3),
ADD COLUMN     "canReactivate" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletionReason" TEXT,
ADD COLUMN     "deletionType" "DeletionType",
ADD COLUMN     "isBlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reactivateWithin" TIMESTAMP(3),
DROP COLUMN "role",
ADD COLUMN     "role" "UserRoles" NOT NULL DEFAULT 'CUSTOMER';

-- DropEnum
DROP TYPE "Role";

-- CreateIndex
CREATE INDEX "credentials_role_idx" ON "credentials"("role");

-- CreateIndex
CREATE INDEX "credentials_deletedAt_idx" ON "credentials"("deletedAt");

-- CreateIndex
CREATE INDEX "credentials_reactivateWithin_idx" ON "credentials"("reactivateWithin");
