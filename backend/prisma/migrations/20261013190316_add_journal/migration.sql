-- CreateEnum
CREATE TYPE "JournalStatus" AS ENUM ('UNRESOLVED', 'IN_PROGRESS', 'RESOLVED');

-- CreateEnum
CREATE TYPE "AttemptOutcome" AS ENUM ('WORKED', 'FAILED');

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "status" "JournalStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "symptom" TEXT NOT NULL,
    "possibleCauses" TEXT NOT NULL DEFAULT '',
    "notes" TEXT,
    "filamentId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalAttempt" (
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "outcome" "AttemptOutcome",
    "triedAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "entryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalPhoto" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JournalEntry_userId_occurredAt_idx" ON "JournalEntry"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "JournalEntry_filamentId_idx" ON "JournalEntry"("filamentId");

-- CreateIndex
CREATE INDEX "JournalAttempt_entryId_position_idx" ON "JournalAttempt"("entryId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "JournalPhoto_filename_key" ON "JournalPhoto"("filename");

-- CreateIndex
CREATE INDEX "JournalPhoto_entryId_createdAt_idx" ON "JournalPhoto"("entryId", "createdAt");

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_filamentId_fkey" FOREIGN KEY ("filamentId") REFERENCES "Filament"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalAttempt" ADD CONSTRAINT "JournalAttempt_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalPhoto" ADD CONSTRAINT "JournalPhoto_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
