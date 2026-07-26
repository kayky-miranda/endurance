-- AlterTable
ALTER TABLE "FinancialEntry" ADD COLUMN     "appointmentId" TEXT;

-- CreateIndex
CREATE INDEX "FinancialEntry_appointmentId_idx" ON "FinancialEntry"("appointmentId");
