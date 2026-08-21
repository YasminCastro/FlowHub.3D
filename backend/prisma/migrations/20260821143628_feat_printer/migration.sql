-- CreateTable
CREATE TABLE "Printer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "nozzle" TEXT,
    "extrusionType" TEXT,
    "filamentType" TEXT,
    "powerConsumptionW" DOUBLE PRECISION,
    "energyCostPerKwh" DOUBLE PRECISION,
    "maintenanceCostPerHour" DOUBLE PRECISION,
    "purchasePrice" DOUBLE PRECISION,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "lastMaintenanceDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Printer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Printer_userId_name_key" ON "Printer"("userId", "name");

-- AddForeignKey
ALTER TABLE "Printer" ADD CONSTRAINT "Printer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
