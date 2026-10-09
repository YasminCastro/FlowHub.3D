-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('LUBRICATION', 'CLEANING', 'NOZZLE_CHANGE', 'BED_CHANGE', 'LEVELING', 'OTHER');

-- CreateTable
CREATE TABLE "PrinterMaintenance" (
    "id" TEXT NOT NULL,
    "type" "MaintenanceType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "printerHours" DOUBLE PRECISION,
    "cost" DOUBLE PRECISION,
    "description" TEXT,
    "remindAfterHours" DOUBLE PRECISION,
    "nozzleInstalled" TEXT,
    "nozzleRemoved" TEXT,
    "printerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrinterMaintenance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrinterMaintenance_printerId_date_idx" ON "PrinterMaintenance"("printerId", "date");

-- AddForeignKey
ALTER TABLE "PrinterMaintenance" ADD CONSTRAINT "PrinterMaintenance_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
