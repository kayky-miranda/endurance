import { expect, test } from "@playwright/test";
import path from "path";
import { createProduct, signupWorkspace } from "./helpers";

const shot = (name: string) =>
  path.join(process.cwd(), "pix-screens", `${name}.png`);

/**
 * Fluxo PIX no PDV (modo simulado) → conciliação.
 * Gera a cobrança PIX (QR no modal), confirma o pagamento (simulado), finaliza
 * a venda e confere que ela aparece como CONCILIADA no Financeiro.
 */
test("venda PIX no PDV gera QR, confirma e concilia", async ({ page }) => {
  const slug = await signupWorkspace(page, "Mercadinho PIX E2E");
  await createProduct(page, slug, {
    name: "Refri PIX 2L",
    price: "12",
    stock: "5",
  });

  // PDV: inicia a venda e adiciona o produto.
  await page.goto(`/espaco/${slug}/m/pdv`);
  await page.getByRole("button", { name: "Iniciar venda" }).click();
  await page
    .getByRole("button")
    .filter({ hasText: "Refri PIX 2L" })
    .first()
    .click();

  // Paga em PIX e finaliza → abre o modal da cobrança.
  await page.getByRole("button", { name: "Pix", exact: true }).click();
  await page.getByRole("button", { name: /Finalizar venda/ }).click();

  // Modal PIX: QR/“copia e cola” + botão de confirmação (simulado).
  await expect(page.getByText("Pagamento PIX")).toBeVisible();
  await expect(page.getByAltText("QR Code PIX")).toBeVisible();
  await page.screenshot({ path: shot("01-modal-qr"), fullPage: true });

  // Confirma o pagamento (no modo real isso viria do PSP via webhook/polling).
  await page
    .getByRole("button", { name: /Confirmar pagamento \(simulado\)/ })
    .click();

  await expect(page.getByText(/Venda finalizada/)).toBeVisible({
    timeout: 30_000,
  });
  await page.screenshot({ path: shot("02-venda-finalizada"), fullPage: true });

  // Financeiro → aba Conciliação PIX → a cobrança aparece conciliada.
  await page.goto(`/espaco/${slug}/m/financeiro`);
  await page.getByRole("button", { name: "Conciliação PIX" }).click();
  await expect(page.getByText("Conciliado").first()).toBeVisible();
  await expect(page.getByText("Recebido em PIX")).toBeVisible();
  await page.screenshot({ path: shot("03-conciliacao"), fullPage: true });
});
