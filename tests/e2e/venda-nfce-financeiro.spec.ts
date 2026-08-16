import { expect, test } from "@playwright/test";
import {
  configureFiscal,
  createProduct,
  sellOneInCash,
  signupWorkspace,
  verifyOwnerEmail,
} from "./helpers";
import { disconnectTokens } from "./email-tokens-helper";

/**
 * Fluxo 2 — Venda no PDV → emissão da NFC-e → recebível no financeiro.
 * Fecha o ciclo operacional: a venda baixa estoque, gera o documento fiscal
 * e o lançamento financeiro correspondente.
 */
test.afterAll(async () => {
  await disconnectTokens();
});

test("venda no PDV emite NFC-e e gera o recebível no financeiro", async ({
  page,
}) => {
  const { slug, email } = await signupWorkspace(page, "Mercadinho Fluxo Fiscal", {
    withCredentials: true,
  });
  // A emissão fiscal exige e-mail verificado (gate de compliance).
  await verifyOwnerEmail(page, email);
  await createProduct(page, slug, {
    name: "Café E2E 500g",
    price: "10",
    stock: "5",
  });

  // Venda de R$ 10,00 em dinheiro.
  await sellOneInCash(page, slug, "Café E2E 500g");

  // Fiscal: deixa o estabelecimento apto pelo cadastro real e emite.
  await configureFiscal(page, slug);

  await page.goto(`/espaco/${slug}/m/nfce`);
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
