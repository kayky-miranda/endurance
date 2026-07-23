import "server-only";
import { prisma } from "@/lib/db";

/**
 * Configuração do cupom/recibo. Uma linha por organização; a leitura devolve
 * os defaults quando ainda não foi configurado, então o recibo sempre tem
 * valores válidos sem precisar de seed.
 */

export interface ReceiptConfig {
  paperSize: "80mm" | "a4";
  showLogo: boolean;
  showDocument: boolean;
  headerNote: string;
  footer: string;
}

const DEFAULTS: ReceiptConfig = {
  paperSize: "80mm",
  showLogo: true,
  showDocument: true,
  headerNote: "",
  footer: "Obrigado pela preferência!",
};

export async function getReceiptConfig(org: string): Promise<ReceiptConfig> {
  const row = await prisma.receiptSettings.findUnique({
    where: { organizationId: org },
  });
  if (!row) return { ...DEFAULTS };
  return {
    paperSize: row.paperSize === "a4" ? "a4" : "80mm",
    showLogo: row.showLogo,
    showDocument: row.showDocument,
    headerNote: row.headerNote,
    footer: row.footer,
  };
}

export async function saveReceiptConfig(
  org: string,
  input: Partial<ReceiptConfig>,
): Promise<ReceiptConfig> {
  const data = {
    paperSize: (input.paperSize === "a4" ? "a4" : "80mm") as "80mm" | "a4",
    showLogo: input.showLogo ?? true,
    showDocument: input.showDocument ?? true,
    headerNote: (input.headerNote ?? "").trim().slice(0, 120),
    footer: (input.footer ?? "").trim().slice(0, 160) || DEFAULTS.footer,
  };
  await prisma.receiptSettings.upsert({
    where: { organizationId: org },
    create: { organizationId: org, ...data },
    update: data,
  });
  return data;
}
