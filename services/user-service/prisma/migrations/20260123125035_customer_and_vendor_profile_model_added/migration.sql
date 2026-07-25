-- CreateTable
CREATE TABLE "customer_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "avatar" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "shippingAddresses" JSONB[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "avatar" TEXT,
    "country" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "shopEmail" TEXT NOT NULL,
    "shopPhone" TEXT NOT NULL,
    "shopAddress" JSONB NOT NULL,
    "stripeConnectId" TEXT,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "totalProducts" INTEGER NOT NULL DEFAULT 0,
    "totalSales" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_profiles_userId_key" ON "customer_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_profiles_userId_key" ON "vendor_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_profiles_shopName_key" ON "vendor_profiles"("shopName");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_profiles_stripeConnectId_key" ON "vendor_profiles"("stripeConnectId");

-- CreateIndex
CREATE INDEX "vendor_profiles_shopName_idx" ON "vendor_profiles"("shopName");

-- CreateIndex
CREATE INDEX "vendor_profiles_isVerified_idx" ON "vendor_profiles"("isVerified");

-- AddForeignKey
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_profiles" ADD CONSTRAINT "vendor_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
