-- CreateTable
CREATE TABLE "password_resets" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "resetToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_resets_resetToken_key" ON "password_resets"("resetToken");

-- CreateIndex
CREATE INDEX "password_resets_resetToken_idx" ON "password_resets"("resetToken");

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
