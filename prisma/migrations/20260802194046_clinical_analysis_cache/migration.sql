-- CreateTable
CREATE TABLE "ClinicalAnalysisCache" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "niche" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicalAnalysisCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClinicalAnalysisCache_organizationId_customerId_idx" ON "ClinicalAnalysisCache"("organizationId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalAnalysisCache_organizationId_customerId_key" ON "ClinicalAnalysisCache"("organizationId", "customerId");

-- AddForeignKey
ALTER TABLE "ClinicalAnalysisCache" ADD CONSTRAINT "ClinicalAnalysisCache_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
