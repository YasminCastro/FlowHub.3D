-- Cores preferidas viram texto livre ("Pastéis", "Preto") em vez de { name, hex }.
ALTER TABLE "Brand" DROP COLUMN "preferredColors",
ADD COLUMN     "preferredColors" TEXT[] DEFAULT ARRAY[]::TEXT[];
