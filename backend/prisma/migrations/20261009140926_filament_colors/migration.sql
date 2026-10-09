-- As cores do filamento viram uma lista (1 a 3): colorHex e secondaryColorHex
-- são copiadas para "colors", na mesma ordem, antes de sair.

-- AlterTable
ALTER TABLE "Filament" ADD COLUMN "colors" TEXT[];

-- Copia os dados existentes (a segunda cor só quando existia)
UPDATE "Filament"
SET "colors" = array_remove(ARRAY["colorHex", "secondaryColorHex"], NULL);

-- AlterTable
ALTER TABLE "Filament" DROP COLUMN "colorHex",
DROP COLUMN "secondaryColorHex";
