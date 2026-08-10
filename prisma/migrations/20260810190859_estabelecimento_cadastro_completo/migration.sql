-- AlterTable
ALTER TABLE "FiscalConfig" ADD COLUMN     "bairro" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "cep" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "cnaePrincipal" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "cnaeSecundarios" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "complemento" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "dataAbertura" TIMESTAMP(3),
ADD COLUMN     "email" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "indicadorIe" TEXT NOT NULL DEFAULT '1',
ADD COLUMN     "inscricaoMunicipal" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "logradouro" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "naturezaJuridica" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "naturezaOperacao" TEXT NOT NULL DEFAULT 'Venda ao consumidor',
ADD COLUMN     "numeroEnd" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "pais" TEXT NOT NULL DEFAULT 'Brasil',
ADD COLUMN     "porte" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "respCargo" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "respCpf" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "respEmail" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "respNome" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "respTelefone" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "site" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "situacaoCadastral" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "telefone" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "CompanyContact" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyContact_organizationId_area_idx" ON "CompanyContact"("organizationId", "area");

-- AddForeignKey
ALTER TABLE "CompanyContact" ADD CONSTRAINT "CompanyContact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
