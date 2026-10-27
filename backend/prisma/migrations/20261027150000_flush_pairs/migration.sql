-- CreateTable
CREATE TABLE "FlushPair" (
    "id" TEXT NOT NULL,
    "slicer" "CalibrationSlicer" NOT NULL,
    "filamentAId" TEXT NOT NULL,
    "filamentBId" TEXT NOT NULL,
    "volumeAToB" INTEGER,
    "volumeBToA" INTEGER,
    "colorMultiplierA" DOUBLE PRECISION,
    "colorMultiplierB" DOUBLE PRECISION,
    "multiplier" DOUBLE PRECISION,
    "printerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlushPair_pkey" PRIMARY KEY ("id"),
    -- A troca de um filamento para ele mesmo não tem volume.
    CONSTRAINT "FlushPair_distinct_filaments" CHECK ("filamentAId" <> "filamentBId")
);

-- CreateIndex
CREATE INDEX "FlushPair_filamentAId_idx" ON "FlushPair"("filamentAId");

-- CreateIndex
CREATE INDEX "FlushPair_filamentBId_idx" ON "FlushPair"("filamentBId");

-- CreateIndex
CREATE INDEX "FlushPair_printerId_idx" ON "FlushPair"("printerId");

-- CreateIndex
CREATE UNIQUE INDEX "FlushPair_userId_filamentAId_filamentBId_printerId_slicer_key" ON "FlushPair"("userId", "filamentAId", "filamentBId", "printerId", "slicer");

-- AddForeignKey
ALTER TABLE "FlushPair" ADD CONSTRAINT "FlushPair_filamentAId_fkey" FOREIGN KEY ("filamentAId") REFERENCES "Filament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlushPair" ADD CONSTRAINT "FlushPair_filamentBId_fkey" FOREIGN KEY ("filamentBId") REFERENCES "Filament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlushPair" ADD CONSTRAINT "FlushPair_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlushPair" ADD CONSTRAINT "FlushPair_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Copia o que já estava salvo por troca: um par por dois filamentos que
-- tenham pelo menos um volume, com o Color Multiplier de cada filamento e o
-- Multiplier da impressora + fatiador.
INSERT INTO "FlushPair" (
    "id", "slicer", "filamentAId", "filamentBId", "volumeAToB", "volumeBToA",
    "colorMultiplierA", "colorMultiplierB", "multiplier", "printerId",
    "userId", "updatedAt"
)
SELECT
    gen_random_uuid()::text, p."slicer", p."a", p."b", ab."volume", ba."volume",
    ca."value", cb."value", m."value", p."printerId", p."userId",
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT
        LEAST("fromFilamentId", "toFilamentId") AS "a",
        GREATEST("fromFilamentId", "toFilamentId") AS "b",
        "printerId", "userId", "slicer"
    FROM "FlushVolume"
) p
LEFT JOIN "FlushVolume" ab
    ON ab."fromFilamentId" = p."a" AND ab."toFilamentId" = p."b"
    AND ab."printerId" = p."printerId" AND ab."userId" = p."userId" AND ab."slicer" = p."slicer"
LEFT JOIN "FlushVolume" ba
    ON ba."fromFilamentId" = p."b" AND ba."toFilamentId" = p."a"
    AND ba."printerId" = p."printerId" AND ba."userId" = p."userId" AND ba."slicer" = p."slicer"
LEFT JOIN "FlushColorMultiplier" ca
    ON ca."filamentId" = p."a"
    AND ca."printerId" = p."printerId" AND ca."userId" = p."userId" AND ca."slicer" = p."slicer"
LEFT JOIN "FlushColorMultiplier" cb
    ON cb."filamentId" = p."b"
    AND cb."printerId" = p."printerId" AND cb."userId" = p."userId" AND cb."slicer" = p."slicer"
LEFT JOIN "FlushMultiplier" m
    ON m."printerId" = p."printerId" AND m."userId" = p."userId" AND m."slicer" = p."slicer";

-- DropTable
DROP TABLE "FlushVolume";

-- DropTable
DROP TABLE "FlushColorMultiplier";

-- DropTable
DROP TABLE "FlushMultiplier";
