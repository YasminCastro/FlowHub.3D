-- AlterEnum
BEGIN;
CREATE TYPE "MaintenanceType_new" AS ENUM ('LUBRICATION', 'CLEANING', 'NOZZLE_CHANGE', 'OTHER');
ALTER TABLE "PrinterMaintenance" ALTER COLUMN "type" TYPE "MaintenanceType_new" USING ("type"::text::"MaintenanceType_new");
ALTER TYPE "MaintenanceType" RENAME TO "MaintenanceType_old";
ALTER TYPE "MaintenanceType_new" RENAME TO "MaintenanceType";
DROP TYPE "public"."MaintenanceType_old";
COMMIT;

