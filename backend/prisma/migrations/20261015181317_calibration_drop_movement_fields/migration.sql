/*
  Warnings:

  - You are about to drop the column `fanPercent` on the `Calibration` table. All the data in the column will be lost.
  - You are about to drop the column `retractionSpeed` on the `Calibration` table. All the data in the column will be lost.
  - You are about to drop the column `speed` on the `Calibration` table. All the data in the column will be lost.
  - You are about to drop the column `fanPercent` on the `CalibrationVersion` table. All the data in the column will be lost.
  - You are about to drop the column `retractionSpeed` on the `CalibrationVersion` table. All the data in the column will be lost.
  - You are about to drop the column `speed` on the `CalibrationVersion` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Calibration" DROP COLUMN "fanPercent",
DROP COLUMN "retractionSpeed",
DROP COLUMN "speed";

-- AlterTable
ALTER TABLE "CalibrationVersion" DROP COLUMN "fanPercent",
DROP COLUMN "retractionSpeed",
DROP COLUMN "speed";
