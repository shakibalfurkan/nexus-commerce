/*
  Warnings:

  - Changed the column `role` on the `credentials` table from a scalar field to a list field. If there are non-null values in that column, this step will fail.

*/
-- AlterTable
ALTER TABLE "credentials" ALTER COLUMN "role" DROP DEFAULT,
ALTER COLUMN "role" TYPE "UserRoles"[] USING ARRAY["role"]::"UserRoles"[];