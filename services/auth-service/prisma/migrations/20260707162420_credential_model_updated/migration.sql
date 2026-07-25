/*
  Warnings:

  - You are about to drop the column `blockReason` on the `credentials` table. All the data in the column will be lost.
  - You are about to drop the column `blockedAt` on the `credentials` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "credentials" DROP COLUMN "blockReason",
DROP COLUMN "blockedAt",
ADD COLUMN     "syncedVersion" INTEGER NOT NULL DEFAULT 0;
