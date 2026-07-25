/*
  Warnings:

  - You are about to drop the column `vendorProfileId` on the `shop_addresses` table. All the data in the column will be lost.
  - You are about to drop the `vendor_profiles` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[sellerProfileId]` on the table `shop_addresses` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `sellerProfileId` to the `shop_addresses` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "shop_addresses" DROP CONSTRAINT "shop_addresses_vendorProfileId_fkey";

-- DropForeignKey
ALTER TABLE "vendor_profiles" DROP CONSTRAINT "vendor_profiles_userId_fkey";

-- DropIndex
DROP INDEX "shop_addresses_vendorProfileId_key";

-- AlterTable
ALTER TABLE "shop_addresses" DROP COLUMN "vendorProfileId",
ADD COLUMN     "sellerProfileId" TEXT NOT NULL;

-- DropTable
DROP TABLE "vendor_profiles";

-- CreateTable
CREATE TABLE "seller_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "avatar" TEXT,
    "shopName" TEXT NOT NULL,
    "shopEmail" TEXT NOT NULL,
    "shopPhone" TEXT NOT NULL,
    "stripeConnectId" TEXT,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "totalProducts" INTEGER NOT NULL DEFAULT 0,
    "salesCount" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seller_profiles_userId_key" ON "seller_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "seller_profiles_shopName_key" ON "seller_profiles"("shopName");

-- CreateIndex
CREATE UNIQUE INDEX "seller_profiles_stripeConnectId_key" ON "seller_profiles"("stripeConnectId");

-- CreateIndex
CREATE INDEX "seller_profiles_shopName_idx" ON "seller_profiles"("shopName");

-- CreateIndex
CREATE UNIQUE INDEX "shop_addresses_sellerProfileId_key" ON "shop_addresses"("sellerProfileId");

-- AddForeignKey
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_addresses" ADD CONSTRAINT "shop_addresses_sellerProfileId_fkey" FOREIGN KEY ("sellerProfileId") REFERENCES "seller_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
