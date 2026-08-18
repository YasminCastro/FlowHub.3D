-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- AlterTable: swap the sequential integer id for a random UUID
ALTER TABLE "User" ADD COLUMN "id_new" TEXT;
UPDATE "User" SET "id_new" = gen_random_uuid()::text;
ALTER TABLE "User" ALTER COLUMN "id_new" SET NOT NULL;

ALTER TABLE "User" DROP CONSTRAINT "User_pkey";
ALTER TABLE "User" DROP COLUMN "id";
ALTER TABLE "User" RENAME COLUMN "id_new" TO "id";
ALTER TABLE "User" ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");

DROP SEQUENCE IF EXISTS "User_id_seq";
