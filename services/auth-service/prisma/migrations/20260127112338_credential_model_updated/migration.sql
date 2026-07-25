/*
  Warnings:

  - You are about to drop the column `deletionReason` on the `credentials` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "credentials" DROP COLUMN "deletionReason";
