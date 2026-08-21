/*
  Warnings:

  - You are about to drop the column `filamentType` on the `Printer` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Printer" DROP COLUMN "filamentType",
ADD COLUMN     "filamentsTypes" TEXT[] DEFAULT ARRAY[]::TEXT[];
