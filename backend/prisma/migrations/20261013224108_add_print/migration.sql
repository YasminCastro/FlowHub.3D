-- CreateEnum
CREATE TYPE "PrintOutcome" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateTable
CREATE TABLE "PrintItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "modelUrl" TEXT,
    "categoryId" TEXT,
    "derivedFromId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrintItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintRecord" (
    "id" TEXT NOT NULL,
    "printedAt" TIMESTAMP(3) NOT NULL,
    "units" INTEGER NOT NULL,
    "totalMinutes" INTEGER NOT NULL,
    "printerId" TEXT,
    "printerName" TEXT NOT NULL,
    "slicer" TEXT NOT NULL,
    "layerHeightMm" DOUBLE PRECISION NOT NULL,
    "infillPercent" INTEGER NOT NULL,
    "infillPattern" TEXT NOT NULL,
    "walls" INTEGER NOT NULL,
    "temperatureC" INTEGER NOT NULL,
    "extras" TEXT NOT NULL DEFAULT '',
    "outcome" "PrintOutcome" NOT NULL,
    "failureReason" TEXT,
    "note" TEXT,
    "changeSummary" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "itemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrintRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintRecordFilament" (
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "grams" DOUBLE PRECISION NOT NULL,
    "pricePerGram" DOUBLE PRECISION NOT NULL,
    "colorName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "colors" TEXT[],
    "filamentId" TEXT,
    "recordId" TEXT NOT NULL,

    CONSTRAINT "PrintRecordFilament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintPhoto" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrintPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrintItem_categoryId_idx" ON "PrintItem"("categoryId");

-- CreateIndex
CREATE INDEX "PrintItem_derivedFromId_idx" ON "PrintItem"("derivedFromId");

-- CreateIndex
CREATE UNIQUE INDEX "PrintItem_userId_name_key" ON "PrintItem"("userId", "name");

-- CreateIndex
CREATE INDEX "PrintRecord_itemId_printedAt_idx" ON "PrintRecord"("itemId", "printedAt");

-- CreateIndex
CREATE INDEX "PrintRecord_printerId_idx" ON "PrintRecord"("printerId");

-- CreateIndex
CREATE INDEX "PrintRecordFilament_recordId_position_idx" ON "PrintRecordFilament"("recordId", "position");

-- CreateIndex
CREATE INDEX "PrintRecordFilament_filamentId_idx" ON "PrintRecordFilament"("filamentId");

-- CreateIndex
CREATE UNIQUE INDEX "PrintPhoto_filename_key" ON "PrintPhoto"("filename");

-- CreateIndex
CREATE INDEX "PrintPhoto_recordId_createdAt_idx" ON "PrintPhoto"("recordId", "createdAt");

-- AddForeignKey
ALTER TABLE "PrintItem" ADD CONSTRAINT "PrintItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintItem" ADD CONSTRAINT "PrintItem_derivedFromId_fkey" FOREIGN KEY ("derivedFromId") REFERENCES "PrintItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintItem" ADD CONSTRAINT "PrintItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintRecord" ADD CONSTRAINT "PrintRecord_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintRecord" ADD CONSTRAINT "PrintRecord_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PrintItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintRecordFilament" ADD CONSTRAINT "PrintRecordFilament_filamentId_fkey" FOREIGN KEY ("filamentId") REFERENCES "Filament"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintRecordFilament" ADD CONSTRAINT "PrintRecordFilament_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "PrintRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintPhoto" ADD CONSTRAINT "PrintPhoto_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "PrintRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
