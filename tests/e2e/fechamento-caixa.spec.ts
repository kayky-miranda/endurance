import { expect, test } from "@playwright/test";
import { createProduct, sellOneInCash, signupWorkspace } from "./helpers";

/**
 * Fluxo 3 — Fechamento de caixa.
 * Abre o turno com fundo de troco, vende em dinheiro, faz uma sangria e
 * fecha com a conferência batendo (diferença zero) no histórico.
 */
test("turno de caixa: abertura, venda, sangria e fechamento conferido", async ({
  page,
}) => {
  const slug = await signupWorkspace(page, "Mercadinho Fluxo Caixa");
  await createProduct(page, slug, {
    name: "Pão E2E",
    price: "10",
    stock: "5",
  });

  // Abre o caixa com R$ 100,00 de fundo de troco.
  await page.goto(`/espaco/${slug}/m/caixa`);
  await expect(page.getByText("Caixa fechado")).toBeVisible();
  await page.getByLabel("Fundo de troco (abertura)").fill("100");
  await page.getByRole("button", { name: "Abrir caixa" }).click();
  await expect(page.getByText("Caixa aberto")).toBeVisible();
  await expect(page.getByText(/R\$\s*100,00/).first()).toBeVisible();

  // Venda de R$ 10,00 em dinheiro entra no esperado do turno.
  await sellOneInCash(page, slug, "Pão E2E");
  await page.goto(`/espaco/${slug}/m/caixa`);
  await expect(page.getByText(/R\$\s*110,00/).first()).toBeVisible();

  // Sangria de R$ 30,00 → esperado cai para R$ 80,00.
  await page.getByPlaceholder("Valor (R$)").fill("30");
  await page
    .getByPlaceholder("Motivo (ex.: troco, pagamento fornecedor)")
    .fill("Depósito no banco");
  await page.getByRole("button", { name: "Registrar sangria" }).click();
  await expect(page.getByText(/R\$\s*80,00/).first()).toBeVisible();

  // Conferência: contado igual ao esperado → "Caixa confere".
  await page.getByLabel("Dinheiro contado na gaveta").fill("80");
  await expect(page.getByText("Caixa confere")).toBeVisible();
  await page.getByRole("button", { name: "Fechar caixa" }).click();

  // Turno encerrado: volta ao estado fechado com o histórico registrado.
  await expect(page.getByText("Caixa fechado")).toBeVisible();
  await expect(page.getByText("Histórico de fechamentos")).toBeVisible();
  await expect(page.getByText(/\+\s*R\$\s*0,00/)).toBeVisible();
});
