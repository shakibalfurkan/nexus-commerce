/*
  Warnings:

  - The values [VENDOR] on the enum `UserRoles` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "UserRoles_new" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'SELLER', 'CUSTOMER');
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRoles_new" USING ("role"::text::"UserRoles_new");
ALTER TYPE "UserRoles" RENAME TO "UserRoles_old";
ALTER TYPE "UserRoles_new" RENAME TO "UserRoles";
DROP TYPE "public"."UserRoles_old";
COMMIT;
