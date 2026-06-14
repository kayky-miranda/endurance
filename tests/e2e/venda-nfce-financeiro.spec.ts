import { expect, test } from "@playwright/test";
import { createProduct, sellOneInCash, signupWorkspace } from "./helpers";

/**
 * Fluxo 2 — Venda no PDV → emissão da NFC-e → recebível no financeiro.
 * Fecha o ciclo operacional: a venda baixa estoque, gera o documento fiscal
 * e o lançamento financeiro correspondente.
 */
test("venda no PDV emite NFC-e e gera o recebível no financeiro", async ({
  page,
}) => {
  const slug = await signupWorkspace(page, "Mercadinho Fluxo Fiscal");
  await createProduct(page, slug, {
    name: "Café E2E 500g",
    price: "10",
    stock: "5",
  });

  // Venda de R$ 10,00 em dinheiro.
  await sellOneInCash(page, slug, "Café E2E 500g");

  // Fiscal: completa o emitente (formulário abre sozinho sem config) e emite.
  await page.goto(`/espaco/${slug}/m/nfce`);
  await page
    .getByPlaceholder("00.000.000/0000-00")
    .fill("12.345.678/0001-95");
  await page.getByLabel("Razão social").fill("Mercadinho Fluxo Fiscal LTDA");
  await page.getByRole("button", { name: "Salvar dados fiscais" }).click();
  await expect(page.getByText("Dados fiscais incompletos")).toBeHidden();

  const emitir = page.getByRole("button", { name: "Emitir" }).first();
  await expect(emitir).toBeEnabled();
  await emitir.click();

  // Emissão navega para o DANFE do documento.
  await page.waitForURL(/\/nfce\/[^/?#]+$/, { timeout: 30_000 });

  // De volta à lista: nota autorizada e KPI global refletindo a emissão.
  await page.goto(`/espaco/${slug}/m/nfce`);
  await expect(page.getByText("Autorizada").first()).toBeVisible();
  await expect(page.getByText("Autorizadas no mês")).toBeVisible();

  // Financeiro: venda em dinheiro vira recebível já compensado.
  await page.goto(`/espaco/${slug}/m/financeiro`);
  await expect(page.getByText(/Venda #\w{6} · Dinheiro/)).toBeVisible();
  await expect(page.getByText("Recebido").first()).toBeVisible();
  await expect(page.getByText(/R\$\s*10,00\s*recebido no mês/)).toBeVisible();
});
