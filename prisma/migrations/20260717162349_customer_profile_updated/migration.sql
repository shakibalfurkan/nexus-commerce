/*
  Warnings:

  - A unique constraint covering the columns `[referralCode]` on the table `customer_profiles` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `referralCode` to the `customer_profiles` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "customer_profiles" ADD COLUMN     "defaultShippingAddressId" TEXT,
ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'en-US',
ADD COLUMN     "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "marketingOptInAt" TIMESTAMP(3),
ADD COLUMN     "phoneVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "preferredCurrency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "referralCode" TEXT NOT NULL,
ADD COLUMN     "referredByCode" TEXT,
ADD COLUMN     "signupSource" TEXT,
ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsVersion" TEXT,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- CreateIndex
CREATE UNIQUE INDEX "customer_profiles_referralCode_key" ON "customer_profiles"("referralCode");

-- CreateIndex
CREATE INDEX "customer_profiles_referralCode_idx" ON "customer_profiles"("referralCode");

-- CreateIndex
CREATE INDEX "customer_profiles_createdAt_idx" ON "customer_profiles"("createdAt");
