-- CreateEnum
CREATE TYPE "CustomerTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND');

-- CreateTable
CREATE TABLE "customer_stats" (
    "customerProfileId" TEXT NOT NULL,
    "lifetimeValue" DECIMAL(12,2) NOT NULL,
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "lastOrderAt" TIMESTAMP(3),
    "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "loyaltyTier" "CustomerTier" NOT NULL DEFAULT 'BRONZE',

    CONSTRAINT "customer_stats_pkey" PRIMARY KEY ("customerProfileId")
);

-- AddForeignKey
ALTER TABLE "customer_stats" ADD CONSTRAINT "customer_stats_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "customer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
