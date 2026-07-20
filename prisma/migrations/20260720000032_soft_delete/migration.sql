-- DropIndex
DROP INDEX "Customer_organizationId_idx";

-- DropIndex
DROP INDEX "Product_organizationId_idx";

-- DropIndex
DROP INDEX "Supplier_organizationId_idx";

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Customer_organizationId_deletedAt_idx" ON "Customer"("organizationId", "deletedAt");

-- CreateIndex
CREATE INDEX "Product_organizationId_deletedAt_idx" ON "Product"("organizationId", "deletedAt");

-- CreateIndex
CREATE INDEX "Supplier_organizationId_deletedAt_idx" ON "Supplier"("organizationId", "deletedAt");
