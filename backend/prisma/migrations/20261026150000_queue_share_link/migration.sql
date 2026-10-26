-- AlterTable
ALTER TABLE "User" ADD COLUMN     "queueShareToken" TEXT;

-- AlterTable
ALTER TABLE "PrintQueueEntry" ADD COLUMN     "fromShareLink" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requesterContact" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_queueShareToken_key" ON "User"("queueShareToken");
