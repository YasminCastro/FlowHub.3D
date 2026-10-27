-- CreateTable
CREATE TABLE "FlushVolume" (
    "id" TEXT NOT NULL,
    "slicer" "CalibrationSlicer" NOT NULL,
    "volume" INTEGER NOT NULL,
    "fromFilamentId" TEXT NOT NULL,
    "toFilamentId" TEXT NOT NULL,
    "printerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlushVolume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlushColorMultiplier" (
    "id" TEXT NOT NULL,
    "slicer" "CalibrationSlicer" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "filamentId" TEXT NOT NULL,
    "printerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlushColorMultiplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlushMultiplier" (
    "id" TEXT NOT NULL,
    "slicer" "CalibrationSlicer" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "printerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlushMultiplier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FlushVolume_fromFilamentId_idx" ON "FlushVolume"("fromFilamentId");

-- CreateIndex
CREATE INDEX "FlushVolume_toFilamentId_idx" ON "FlushVolume"("toFilamentId");

-- CreateIndex
CREATE INDEX "FlushVolume_printerId_idx" ON "FlushVolume"("printerId");

-- CreateIndex
CREATE UNIQUE INDEX "FlushVolume_userId_fromFilamentId_toFilamentId_printerId_sl_key" ON "FlushVolume"("userId", "fromFilamentId", "toFilamentId", "printerId", "slicer");

-- CreateIndex
CREATE INDEX "FlushColorMultiplier_filamentId_idx" ON "FlushColorMultiplier"("filamentId");

-- CreateIndex
CREATE INDEX "FlushColorMultiplier_printerId_idx" ON "FlushColorMultiplier"("printerId");

-- CreateIndex
CREATE UNIQUE INDEX "FlushColorMultiplier_userId_filamentId_printerId_slicer_key" ON "FlushColorMultiplier"("userId", "filamentId", "printerId", "slicer");

-- CreateIndex
CREATE INDEX "FlushMultiplier_printerId_idx" ON "FlushMultiplier"("printerId");

-- CreateIndex
CREATE UNIQUE INDEX "FlushMultiplier_userId_printerId_slicer_key" ON "FlushMultiplier"("userId", "printerId", "slicer");

-- AddForeignKey
ALTER TABLE "FlushVolume" ADD CONSTRAINT "FlushVolume_fromFilamentId_fkey" FOREIGN KEY ("fromFilamentId") REFERENCES "Filament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlushVolume" ADD CONSTRAINT "FlushVolume_toFilamentId_fkey" FOREIGN KEY ("toFilamentId") REFERENCES "Filament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlushVolume" ADD CONSTRAINT "FlushVolume_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlushVolume" ADD CONSTRAINT "FlushVolume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlushColorMultiplier" ADD CONSTRAINT "FlushColorMultiplier_filamentId_fkey" FOREIGN KEY ("filamentId") REFERENCES "Filament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlushColorMultiplier" ADD CONSTRAINT "FlushColorMultiplier_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlushColorMultiplier" ADD CONSTRAINT "FlushColorMultiplier_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlushMultiplier" ADD CONSTRAINT "FlushMultiplier_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlushMultiplier" ADD CONSTRAINT "FlushMultiplier_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A diagonal da tabela (de um filamento para ele mesmo) é sempre 0.
ALTER TABLE "FlushVolume" ADD CONSTRAINT "FlushVolume_distinct_filaments" CHECK ("fromFilamentId" <> "toFilamentId");
