-- CreateEnum
CREATE TYPE "PurchaseChannel" AS ENUM ('OWN_SITE', 'MERCADO_LIVRE', 'AMAZON', 'SHOPEE', 'ALIEXPRESS', 'PHYSICAL_STORE', 'OTHER');

-- CreateEnum
CREATE TYPE "BrandStatus" AS ENUM ('PURCHASED', 'RESEARCHED');

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "purchaseChannels" "PurchaseChannel"[] DEFAULT ARRAY[]::"PurchaseChannel"[],
    "filamentTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "BrandStatus" NOT NULL DEFAULT 'PURCHASED',
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandNote" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Brand_userId_name_key" ON "Brand"("userId", "name");

-- CreateIndex
CREATE INDEX "BrandNote_brandId_createdAt_idx" ON "BrandNote"("brandId", "createdAt");

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandNote" ADD CONSTRAINT "BrandNote_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
