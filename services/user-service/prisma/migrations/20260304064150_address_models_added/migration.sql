/*
  Warnings:

  - You are about to drop the column `shippingAddresses` on the `customer_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `shopAddress` on the `vendor_profiles` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "customer_profiles" DROP COLUMN "shippingAddresses";

-- AlterTable
ALTER TABLE "vendor_profiles" DROP COLUMN "shopAddress";

-- CreateTable
CREATE TABLE "shipping_addresses" (
    "id" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "apartment" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT,
    "customerProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_addresses" (
    "id" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "vendorProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shipping_addresses_customerProfileId_idx" ON "shipping_addresses"("customerProfileId");

-- CreateIndex
CREATE INDEX "shipping_addresses_isDefault_idx" ON "shipping_addresses"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "shop_addresses_vendorProfileId_key" ON "shop_addresses"("vendorProfileId");

-- CreateIndex
CREATE INDEX "shop_addresses_city_idx" ON "shop_addresses"("city");

-- CreateIndex
CREATE INDEX "shop_addresses_country_idx" ON "shop_addresses"("country");

-- AddForeignKey
ALTER TABLE "shipping_addresses" ADD CONSTRAINT "shipping_addresses_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "customer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_addresses" ADD CONSTRAINT "shop_addresses_vendorProfileId_fkey" FOREIGN KEY ("vendorProfileId") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
