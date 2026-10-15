-- Temperaturas por camada: 1ª camada da mesa e camada inicial do bico.
-- Linhas que já existem herdam a temperatura das demais camadas.

-- AlterTable
ALTER TABLE "Calibration" ADD COLUMN "bedTempFirstLayer" INTEGER,
ADD COLUMN "nozzleTempInitial" INTEGER;

UPDATE "Calibration" SET "bedTempFirstLayer" = "bedTemp", "nozzleTempInitial" = "nozzleTemp";

ALTER TABLE "Calibration" ALTER COLUMN "bedTempFirstLayer" SET NOT NULL,
ALTER COLUMN "nozzleTempInitial" SET NOT NULL;

-- AlterTable
ALTER TABLE "CalibrationVersion" ADD COLUMN "bedTempFirstLayer" INTEGER,
ADD COLUMN "nozzleTempInitial" INTEGER;

UPDATE "CalibrationVersion" SET "bedTempFirstLayer" = "bedTemp", "nozzleTempInitial" = "nozzleTemp";

ALTER TABLE "CalibrationVersion" ALTER COLUMN "bedTempFirstLayer" SET NOT NULL,
ALTER COLUMN "nozzleTempInitial" SET NOT NULL;
