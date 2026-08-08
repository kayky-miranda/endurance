-- AlterTable
ALTER TABLE "FiscalConfig" ADD COLUMN     "certValidoAte" TIMESTAMP(3),
ADD COLUMN     "certValidoDe" TIMESTAMP(3),
ADD COLUMN     "focusEmpresaId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "focusTokenHomologacao" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "focusTokenProducao" TEXT NOT NULL DEFAULT '';
