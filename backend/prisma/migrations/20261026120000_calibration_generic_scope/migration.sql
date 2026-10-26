-- AlterTable
ALTER TABLE "Calibration" ADD COLUMN     "brandId" TEXT,
ADD COLUMN     "filamentType" TEXT,
ALTER COLUMN "filamentId" DROP NOT NULL;

-- Específica (só filamentId) ou genérica (só brandId + filamentType).
ALTER TABLE "Calibration" ADD CONSTRAINT "Calibration_scope_check" CHECK (
  ("filamentId" IS NOT NULL AND "brandId" IS NULL AND "filamentType" IS NULL)
  OR ("filamentId" IS NULL AND "brandId" IS NOT NULL AND "filamentType" IS NOT NULL)
);

-- CreateIndex
CREATE INDEX "Calibration_brandId_idx" ON "Calibration"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "Calibration_userId_brandId_filamentType_printerId_slicer_key" ON "Calibration"("userId", "brandId", "filamentType", "printerId", "slicer");

-- AddForeignKey
ALTER TABLE "Calibration" ADD CONSTRAINT "Calibration_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
