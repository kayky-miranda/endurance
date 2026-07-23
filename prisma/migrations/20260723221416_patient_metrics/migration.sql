-- CreateTable
CREATE TABLE "PatientMetric" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "value" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '',
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PatientMetric_organizationId_customerId_metric_measuredAt_idx" ON "PatientMetric"("organizationId", "customerId", "metric", "measuredAt");

-- CreateIndex
CREATE INDEX "PatientMetric_customerId_measuredAt_idx" ON "PatientMetric"("customerId", "measuredAt");

-- AddForeignKey
ALTER TABLE "PatientMetric" ADD CONSTRAINT "PatientMetric_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientMetric" ADD CONSTRAINT "PatientMetric_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
