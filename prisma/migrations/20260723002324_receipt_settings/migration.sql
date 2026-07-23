-- CreateTable
CREATE TABLE "ReceiptSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "paperSize" TEXT NOT NULL DEFAULT '80mm',
    "showLogo" BOOLEAN NOT NULL DEFAULT true,
    "showDocument" BOOLEAN NOT NULL DEFAULT true,
    "headerNote" TEXT NOT NULL DEFAULT '',
    "footer" TEXT NOT NULL DEFAULT 'Obrigado pela preferência!',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReceiptSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptSettings_organizationId_key" ON "ReceiptSettings"("organizationId");

-- AddForeignKey
ALTER TABLE "ReceiptSettings" ADD CONSTRAINT "ReceiptSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
