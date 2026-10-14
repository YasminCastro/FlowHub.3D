-- CreateTable
CREATE TABLE "PrintQueueEntry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "units" INTEGER NOT NULL,
    "totalMinutes" INTEGER NOT NULL,
    "customer" TEXT,
    "modelUrl" TEXT,
    "printItemId" TEXT,
    "printerId" TEXT,
    "printerName" TEXT NOT NULL,
    "lastFailureAt" TIMESTAMP(3),
    "lastFailureReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdItem" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrintQueueEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintQueueFilament" (
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "grams" DOUBLE PRECISION NOT NULL,
    "pricePerGram" DOUBLE PRECISION NOT NULL,
    "colorName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "colors" TEXT[],
    "filamentId" TEXT,
    "entryId" TEXT NOT NULL,

    CONSTRAINT "PrintQueueFilament_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrintQueueEntry_userId_completedAt_position_idx" ON "PrintQueueEntry"("userId", "completedAt", "position");

-- CreateIndex
CREATE INDEX "PrintQueueEntry_printItemId_idx" ON "PrintQueueEntry"("printItemId");

-- CreateIndex
CREATE INDEX "PrintQueueEntry_printerId_idx" ON "PrintQueueEntry"("printerId");

-- CreateIndex
CREATE INDEX "PrintQueueFilament_entryId_position_idx" ON "PrintQueueFilament"("entryId", "position");

-- CreateIndex
CREATE INDEX "PrintQueueFilament_filamentId_idx" ON "PrintQueueFilament"("filamentId");

-- AddForeignKey
ALTER TABLE "PrintQueueEntry" ADD CONSTRAINT "PrintQueueEntry_printItemId_fkey" FOREIGN KEY ("printItemId") REFERENCES "PrintItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintQueueEntry" ADD CONSTRAINT "PrintQueueEntry_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintQueueEntry" ADD CONSTRAINT "PrintQueueEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintQueueFilament" ADD CONSTRAINT "PrintQueueFilament_filamentId_fkey" FOREIGN KEY ("filamentId") REFERENCES "Filament"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintQueueFilament" ADD CONSTRAINT "PrintQueueFilament_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "PrintQueueEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
