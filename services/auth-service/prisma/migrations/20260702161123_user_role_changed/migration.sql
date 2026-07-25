/*
  Warnings:

  - The values [MODERATOR,VENDOR] on the enum `UserRoles` will be removed. If these variants are still used in the database, this will fail.
  - The required column `familyId` was added to the `refresh_tokens` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "UserRoles_new" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'SELLER', 'CUSTOMER');
ALTER TABLE "public"."credentials" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "credentials" ALTER COLUMN "role" TYPE "UserRoles_new" USING ("role"::text::"UserRoles_new");
ALTER TYPE "UserRoles" RENAME TO "UserRoles_old";
ALTER TYPE "UserRoles_new" RENAME TO "UserRoles";
DROP TYPE "public"."UserRoles_old";
ALTER TABLE "credentials" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';
COMMIT;

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "familyId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "refresh_tokens_credentialId_familyId_idx" ON "refresh_tokens"("credentialId", "familyId");
