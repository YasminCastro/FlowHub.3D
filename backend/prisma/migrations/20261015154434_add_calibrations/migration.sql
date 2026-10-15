-- CreateEnum
CREATE TYPE "CalibrationSlicer" AS ENUM ('ORCA', 'CREALITY');

-- CreateTable
CREATE TABLE "Calibration" (
    "id" TEXT NOT NULL,
    "slicer" "CalibrationSlicer" NOT NULL,
    "flow" DOUBLE PRECISION NOT NULL,
    "nozzleTemp" INTEGER NOT NULL,
    "bedTemp" INTEGER NOT NULL,
    "pressureAdvance" DOUBLE PRECISION NOT NULL,
    "retractionDistance" DOUBLE PRECISION,
    "retractionSpeed" INTEGER,
    "speed" INTEGER,
    "fanPercent" INTEGER,
    "notes" TEXT,
    "calibratedAt" TIMESTAMP(3) NOT NULL,
    "filamentId" TEXT NOT NULL,
    "printerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Calibration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationVersion" (
    "id" TEXT NOT NULL,
    "flow" DOUBLE PRECISION NOT NULL,
    "nozzleTemp" INTEGER NOT NULL,
    "bedTemp" INTEGER NOT NULL,
    "pressureAdvance" DOUBLE PRECISION NOT NULL,
    "retractionDistance" DOUBLE PRECISION,
    "retractionSpeed" INTEGER,
    "speed" INTEGER,
    "fanPercent" INTEGER,
    "notes" TEXT,
    "calibratedAt" TIMESTAMP(3) NOT NULL,
    "calibrationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalibrationVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Calibration_filamentId_idx" ON "Calibration"("filamentId");

-- CreateIndex
CREATE INDEX "Calibration_printerId_idx" ON "Calibration"("printerId");

-- CreateIndex
CREATE UNIQUE INDEX "Calibration_userId_filamentId_printerId_slicer_key" ON "Calibration"("userId", "filamentId", "printerId", "slicer");

-- CreateIndex
CREATE INDEX "CalibrationVersion_calibrationId_calibratedAt_idx" ON "CalibrationVersion"("calibrationId", "calibratedAt");

-- AddForeignKey
ALTER TABLE "Calibration" ADD CONSTRAINT "Calibration_filamentId_fkey" FOREIGN KEY ("filamentId") REFERENCES "Filament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calibration" ADD CONSTRAINT "Calibration_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calibration" ADD CONSTRAINT "Calibration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationVersion" ADD CONSTRAINT "CalibrationVersion_calibrationId_fkey" FOREIGN KEY ("calibrationId") REFERENCES "Calibration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
