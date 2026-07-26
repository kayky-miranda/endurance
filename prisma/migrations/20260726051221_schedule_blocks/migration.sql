-- CreateTable
CREATE TABLE "ScheduleBlock" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "professionalId" TEXT,
    "professional" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'bloqueio',
    "reason" TEXT NOT NULL DEFAULT '',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleBlock_organizationId_startsAt_idx" ON "ScheduleBlock"("organizationId", "startsAt");

-- CreateIndex
CREATE INDEX "ScheduleBlock_organizationId_professionalId_startsAt_idx" ON "ScheduleBlock"("organizationId", "professionalId", "startsAt");

-- AddForeignKey
ALTER TABLE "ScheduleBlock" ADD CONSTRAINT "ScheduleBlock_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
