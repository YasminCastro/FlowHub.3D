-- AlterTable
ALTER TABLE "User" ADD COLUMN     "resetPasswordCode" TEXT,
ADD COLUMN     "verificaresetPasswordCodeExpiresAt" TIMESTAMP(3);
