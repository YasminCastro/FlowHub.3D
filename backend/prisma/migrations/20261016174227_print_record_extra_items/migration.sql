-- CreateTable
CREATE TABLE "PrintRecordExtraItem" (
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL,
    "name" TEXT NOT NULL,
    "extraItemId" TEXT,
    "recordId" TEXT NOT NULL,

    CONSTRAINT "PrintRecordExtraItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrintRecordExtraItem_recordId_position_idx" ON "PrintRecordExtraItem"("recordId", "position");

-- CreateIndex
CREATE INDEX "PrintRecordExtraItem_extraItemId_idx" ON "PrintRecordExtraItem"("extraItemId");

-- AddForeignKey
ALTER TABLE "PrintRecordExtraItem" ADD CONSTRAINT "PrintRecordExtraItem_extraItemId_fkey" FOREIGN KEY ("extraItemId") REFERENCES "ExtraItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintRecordExtraItem" ADD CONSTRAINT "PrintRecordExtraItem_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "PrintRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
