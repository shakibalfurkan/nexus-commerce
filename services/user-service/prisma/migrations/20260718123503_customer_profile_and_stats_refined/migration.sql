/*
  Warnings:

  - You are about to drop the column `defaultShippingAddressId` on the `customer_profiles` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `customer_stats` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "customer_profiles_referralCode_idx";

-- DropIndex
DROP INDEX "shipping_addresses_isDefault_idx";

-- AlterTable
ALTER TABLE "customer_profiles" DROP COLUMN "defaultShippingAddressId";

-- AlterTable
ALTER TABLE "customer_stats" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "lifetimeValue" SET DEFAULT 0;

-- CreateIndex
CREATE INDEX "shipping_addresses_profileId_isDefault_idx" ON "shipping_addresses"("profileId", "isDefault");
