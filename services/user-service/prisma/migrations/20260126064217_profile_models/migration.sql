/*
  Warnings:

  - You are about to drop the column `country` on the `vendor_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `totalSales` on the `vendor_profiles` table. All the data in the column will be lost.
  - Changed the type of `role` on the `users` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "UserRoles" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'VENDOR', 'CUSTOMER');

-- DropIndex
DROP INDEX "users_role_idx";

-- AlterTable
ALTER TABLE "customer_profiles" ALTER COLUMN "shippingAddresses" SET DEFAULT ARRAY[]::JSONB[];

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isBlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
DROP COLUMN "role",
ADD COLUMN     "role" "UserRoles" NOT NULL;

-- AlterTable
ALTER TABLE "vendor_profiles" DROP COLUMN "country",
DROP COLUMN "totalSales",
ADD COLUMN     "salesCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- DropEnum
DROP TYPE "Role";

-- CreateTable
CREATE TABLE "admin_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "avatar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_profiles_userId_key" ON "admin_profiles"("userId");

-- CreateIndex
CREATE INDEX "users_isActive_idx" ON "users"("isActive");

-- CreateIndex
CREATE INDEX "users_isBlocked_idx" ON "users"("isBlocked");

-- AddForeignKey
ALTER TABLE "admin_profiles" ADD CONSTRAINT "admin_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
