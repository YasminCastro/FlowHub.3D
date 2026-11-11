-- AlterTable: a escala única vira uma por eixo (X, Y, Z).
ALTER TABLE "PrintRecord"
  ADD COLUMN "scaleX" DOUBLE PRECISION,
  ADD COLUMN "scaleY" DOUBLE PRECISION,
  ADD COLUMN "scaleZ" DOUBLE PRECISION;

-- A escala antiga era uniforme: vale para os três eixos.
UPDATE "PrintRecord"
SET "scaleX" = "scalePercent",
    "scaleY" = "scalePercent",
    "scaleZ" = "scalePercent"
WHERE "scalePercent" IS NOT NULL;

ALTER TABLE "PrintRecord" DROP COLUMN "scalePercent";
