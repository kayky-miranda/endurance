-- CreateTable
CREATE TABLE "Anamnese" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'rascunho',
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Anamnese_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnamneseItem" (
    "id" TEXT NOT NULL,
    "anamneseId" TEXT NOT NULL,
    "question" TEXT NOT NULL DEFAULT '',
    "answer" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AnamneseItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Anamnese_organizationId_deletedAt_idx" ON "Anamnese"("organizationId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Anamnese_organizationId_customerId_key" ON "Anamnese"("organizationId", "customerId");

-- CreateIndex
CREATE INDEX "AnamneseItem_anamneseId_position_idx" ON "AnamneseItem"("anamneseId", "position");

-- AddForeignKey
ALTER TABLE "Anamnese" ADD CONSTRAINT "Anamnese_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anamnese" ADD CONSTRAINT "Anamnese_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnamneseItem" ADD CONSTRAINT "AnamneseItem_anamneseId_fkey" FOREIGN KEY ("anamneseId") REFERENCES "Anamnese"("id") ON DELETE CASCADE ON UPDATE CASCADE;
