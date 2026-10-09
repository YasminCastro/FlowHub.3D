-- CreateEnum
CREATE TYPE "FilamentAvailability" AS ENUM ('AVAILABLE', 'SOLD_OUT');

-- CreateTable
CREATE TABLE "Filament" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "colorName" TEXT NOT NULL,
    "colorHex" TEXT NOT NULL,
    "secondaryColorHex" TEXT,
    "spoolWeightGrams" INTEGER NOT NULL,
    "minPricePaid" DOUBLE PRECISION NOT NULL,
    "maxPricePaid" DOUBLE PRECISION,
    "purchaseCount" INTEGER NOT NULL DEFAULT 1,
    "lastPurchasedAt" TIMESTAMP(3),
    "purchaseChannel" "PurchaseChannel",
    "availability" "FilamentAvailability" NOT NULL DEFAULT 'AVAILABLE',
    "finishedAt" TIMESTAMP(3),
    "rating" INTEGER,
    "ratingComment" TEXT,
    "brandId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Filament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FilamentNote" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "filamentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FilamentNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Filament_brandId_idx" ON "Filament"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "Filament_userId_brandId_type_colorName_key" ON "Filament"("userId", "brandId", "type", "colorName");

-- CreateIndex
CREATE INDEX "FilamentNote_filamentId_createdAt_idx" ON "FilamentNote"("filamentId", "createdAt");

-- AddForeignKey
ALTER TABLE "Filament" ADD CONSTRAINT "Filament_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Filament" ADD CONSTRAINT "Filament_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FilamentNote" ADD CONSTRAINT "FilamentNote_filamentId_fkey" FOREIGN KEY ("filamentId") REFERENCES "Filament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
