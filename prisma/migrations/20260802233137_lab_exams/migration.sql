-- CreateTable
CREATE TABLE "LabExam" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "panel" TEXT NOT NULL DEFAULT '',
    "value" DECIMAL(14,4) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '',
    "refMin" DECIMAL(14,4),
    "refMax" DECIMAL(14,4),
    "collectedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LabExam_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LabExam_organizationId_customerId_collectedAt_idx" ON "LabExam"("organizationId", "customerId", "collectedAt");

-- CreateIndex
CREATE INDEX "LabExam_organizationId_customerId_name_idx" ON "LabExam"("organizationId", "customerId", "name");

-- AddForeignKey
ALTER TABLE "LabExam" ADD CONSTRAINT "LabExam_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabExam" ADD CONSTRAINT "LabExam_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
