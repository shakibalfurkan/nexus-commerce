/*
  Warnings:

  - You are about to drop the column `commissionRate` on the `seller_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `onboardingComplete` on the `seller_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `rating` on the `seller_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `reviewCount` on the `seller_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `salesCount` on the `seller_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `shopEmail` on the `seller_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `shopName` on the `seller_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `shopPhone` on the `seller_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `stripeConnectId` on the `seller_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `totalProducts` on the `seller_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `totalRevenue` on the `seller_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `emailBlindIndex` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `encryptedEmail` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `encryption_keys` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `shop_addresses` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `actorDisplayName` to the `audit_logs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `actorEmail` to the `audit_logs` table without a default value. This is not possible if the table is not empty.
  - Changed the column `role` on the `users` table from a scalar field to a list field. If there are non-null values in that column, this step will fail.

*/
-- DropForeignKey
ALTER TABLE "shop_addresses" DROP CONSTRAINT "shop_addresses_sellerProfileId_fkey";

-- DropIndex
DROP INDEX "seller_profiles_shopName_idx";

-- DropIndex
DROP INDEX "seller_profiles_shopName_key";

-- DropIndex
DROP INDEX "seller_profiles_stripeConnectId_key";

-- DropIndex
DROP INDEX "users_emailBlindIndex_idx";

-- DropIndex
DROP INDEX "users_emailBlindIndex_key";

-- DropIndex
DROP INDEX "users_encryptedEmail_key";

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "actorDisplayName" TEXT NOT NULL,
ADD COLUMN     "actorEmail" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "seller_profiles" DROP COLUMN "commissionRate",
DROP COLUMN "onboardingComplete",
DROP COLUMN "rating",
DROP COLUMN "reviewCount",
DROP COLUMN "salesCount",
DROP COLUMN "shopEmail",
DROP COLUMN "shopName",
DROP COLUMN "shopPhone",
DROP COLUMN "stripeConnectId",
DROP COLUMN "totalProducts",
DROP COLUMN "totalRevenue",
ADD COLUMN     "bio" TEXT;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "emailBlindIndex",
DROP COLUMN "encryptedEmail",
ALTER COLUMN "role" TYPE "UserRoles"[] USING ARRAY["role"]::"UserRoles"[];

-- DropTable
DROP TABLE "encryption_keys";

-- DropTable
DROP TABLE "shop_addresses";
