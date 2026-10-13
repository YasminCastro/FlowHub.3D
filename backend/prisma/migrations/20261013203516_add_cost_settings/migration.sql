-- CreateTable
CREATE TABLE "CostSettings" (
    "id" TEXT NOT NULL,
    "energyCostPerKwh" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "laborCostPerHour" DOUBLE PRECISION NOT NULL,
    "prepMinutesPerPiece" INTEGER NOT NULL,
    "defaultMarginPercent" DOUBLE PRECISION NOT NULL,
    "packagingCost" DOUBLE PRECISION NOT NULL,
    "failureReservePercent" DOUBLE PRECISION NOT NULL,
    "otherFixedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CostSettings_userId_key" ON "CostSettings"("userId");

-- AddForeignKey
ALTER TABLE "CostSettings" ADD CONSTRAINT "CostSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
