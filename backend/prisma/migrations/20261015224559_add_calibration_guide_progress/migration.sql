-- CreateTable
CREATE TABLE "CalibrationGuideProgress" (
    "id" TEXT NOT NULL,
    "slicer" "CalibrationSlicer" NOT NULL,
    "results" JSONB NOT NULL DEFAULT '{}',
    "activeStep" TEXT NOT NULL DEFAULT 'temperature',
    "filamentId" TEXT NOT NULL,
    "printerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalibrationGuideProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalibrationGuideProgress_filamentId_idx" ON "CalibrationGuideProgress"("filamentId");

-- CreateIndex
CREATE INDEX "CalibrationGuideProgress_printerId_idx" ON "CalibrationGuideProgress"("printerId");

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationGuideProgress_userId_filamentId_printerId_slicer_key" ON "CalibrationGuideProgress"("userId", "filamentId", "printerId", "slicer");

-- AddForeignKey
ALTER TABLE "CalibrationGuideProgress" ADD CONSTRAINT "CalibrationGuideProgress_filamentId_fkey" FOREIGN KEY ("filamentId") REFERENCES "Filament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationGuideProgress" ADD CONSTRAINT "CalibrationGuideProgress_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationGuideProgress" ADD CONSTRAINT "CalibrationGuideProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
