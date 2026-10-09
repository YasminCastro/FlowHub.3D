-- CreateEnum
CREATE TYPE "SpoolLevel" AS ENUM ('FULL', 'LOW', 'FINISHED');

-- AlterTable
ALTER TABLE "Filament" ADD COLUMN     "spoolLevel" "SpoolLevel" NOT NULL DEFAULT 'FULL';

-- Quem já estava marcado como acabado continua acabado.
UPDATE "Filament" SET "spoolLevel" = 'FINISHED' WHERE "finishedAt" IS NOT NULL;
