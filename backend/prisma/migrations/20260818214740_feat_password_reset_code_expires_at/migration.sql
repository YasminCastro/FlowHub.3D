/*
  Warnings:

  - You are about to drop the column `verificaresetPasswordCodeExpiresAt` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "verificaresetPasswordCodeExpiresAt",
ADD COLUMN     "passwordResetCodeExpiresAt" TIMESTAMP(3);
