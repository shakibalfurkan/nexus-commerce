/*
  Warnings:

  - You are about to drop the column `isVerified` on the `vendor_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `verifiedAt` on the `vendor_profiles` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "vendor_profiles_isVerified_idx";

-- AlterTable
ALTER TABLE "vendor_profiles" DROP COLUMN "isVerified",
DROP COLUMN "verifiedAt";
