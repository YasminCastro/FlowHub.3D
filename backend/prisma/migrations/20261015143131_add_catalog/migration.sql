-- CreateEnum
CREATE TYPE "CatalogKind" AS ENUM ('SINGLE', 'SIZES', 'KIT');

-- CreateTable
CREATE TABLE "CatalogItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" "CatalogKind" NOT NULL,
    "kitPrice" DOUBLE PRECISION,
    "categoryId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogVariant" (
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "priceOverride" DOUBLE PRECISION,
    "printItemId" TEXT,
    "catalogItemId" TEXT NOT NULL,

    CONSTRAINT "CatalogVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogPhoto" (
    "position" INTEGER NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,

    CONSTRAINT "CatalogPhoto_pkey" PRIMARY KEY ("catalogItemId","photoId")
);

-- CreateIndex
CREATE INDEX "CatalogItem_categoryId_idx" ON "CatalogItem"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogItem_userId_name_key" ON "CatalogItem"("userId", "name");

-- CreateIndex
CREATE INDEX "CatalogVariant_catalogItemId_position_idx" ON "CatalogVariant"("catalogItemId", "position");

-- CreateIndex
CREATE INDEX "CatalogVariant_printItemId_idx" ON "CatalogVariant"("printItemId");

-- CreateIndex
CREATE INDEX "CatalogPhoto_photoId_idx" ON "CatalogPhoto"("photoId");

-- AddForeignKey
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogVariant" ADD CONSTRAINT "CatalogVariant_printItemId_fkey" FOREIGN KEY ("printItemId") REFERENCES "PrintItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogVariant" ADD CONSTRAINT "CatalogVariant_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogPhoto" ADD CONSTRAINT "CatalogPhoto_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogPhoto" ADD CONSTRAINT "CatalogPhoto_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "PrintPhoto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
