-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "locationId" TEXT;

-- AlterTable
ALTER TABLE "StockCount" ADD COLUMN     "locationId" TEXT;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "locationId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "locationId" TEXT;

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "address" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductStock" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductStock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Location_organizationId_active_idx" ON "Location"("organizationId", "active");

-- CreateIndex
CREATE INDEX "ProductStock_organizationId_locationId_idx" ON "ProductStock"("organizationId", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductStock_productId_locationId_key" ON "ProductStock"("productId", "locationId");

-- CreateIndex
CREATE INDEX "Sale_organizationId_locationId_idx" ON "Sale"("organizationId", "locationId");

-- CreateIndex
CREATE INDEX "StockMovement_locationId_idx" ON "StockMovement"("locationId");

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductStock" ADD CONSTRAINT "ProductStock_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductStock" ADD CONSTRAINT "ProductStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductStock" ADD CONSTRAINT "ProductStock_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ===========================================================================
-- BACKFILL do multi-local: toda organização existente ganha a "Matriz" como
-- local padrão, todo o saldo atual dos produtos passa a residir nela, e as
-- movimentações/vendas históricas são apontadas para lá. Assim o total
-- consolidado (Product.stock) continua igual à soma dos locais desde o
-- primeiro instante.
-- ===========================================================================

INSERT INTO "Location" ("id", "organizationId", "name", "code", "isDefault", "active", "createdAt")
SELECT 'loc_' || o."id", o."id", 'Matriz', 'MTZ', true, true, NOW()
FROM "Organization" o;

INSERT INTO "ProductStock" ("id", "organizationId", "productId", "locationId", "qty", "updatedAt")
SELECT 'ps_' || p."id", p."organizationId", p."id", 'loc_' || p."organizationId", p."stock", NOW()
FROM "Product" p;

UPDATE "StockMovement" SET "locationId" = 'loc_' || "organizationId" WHERE "locationId" IS NULL;
UPDATE "Sale" SET "locationId" = 'loc_' || "organizationId" WHERE "locationId" IS NULL;
