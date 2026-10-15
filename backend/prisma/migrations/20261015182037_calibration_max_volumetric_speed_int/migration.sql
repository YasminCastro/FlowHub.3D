/*
  Warnings:

  - You are about to alter the column `maxVolumetricSpeed` on the `Calibration` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `maxVolumetricSpeed` on the `CalibrationVersion` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.

*/
-- AlterTable
ALTER TABLE "Calibration" ALTER COLUMN "maxVolumetricSpeed" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "CalibrationVersion" ALTER COLUMN "maxVolumetricSpeed" SET DATA TYPE INTEGER;
