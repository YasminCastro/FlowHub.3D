-- CreateTable
CREATE TABLE "ExtraItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtraItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtraItemLot" (
    "id" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL,
    "extraItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtraItemLot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExtraItem_userId_name_key" ON "ExtraItem"("userId", "name");

-- CreateIndex
CREATE INDEX "ExtraItemLot_extraItemId_purchasedAt_idx" ON "ExtraItemLot"("extraItemId", "purchasedAt");

-- AddForeignKey
ALTER TABLE "ExtraItem" ADD CONSTRAINT "ExtraItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraItemLot" ADD CONSTRAINT "ExtraItemLot_extraItemId_fkey" FOREIGN KEY ("extraItemId") REFERENCES "ExtraItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
