import { expect, test } from "@playwright/test";
import path from "path";
import { createProduct, signupWorkspace } from "./helpers";

const shot = (name: string) =>
  path.join(process.cwd(), "pix-screens", `${name}.png`);

/**
 * Fluxo PIX na MAQUININHA (Mercado Pago Point), modo simulado.
 * Configura um aparelho, vende com "Cobrar PIX na maquininha", confere que o
 * modal mostra o aviso de terminal (não o QR na tela) e finaliza.
 */
test("cobra PIX na maquininha a partir do PDV", async ({ page }) => {
  const slug = await signupWorkspace(page, "Mercadinho Maquininha E2E");
  await createProduct(page, slug, {
    name: "Suco Point 1L",
    price: "9",
    stock: "5",
  });

  // Configura a maquininha em Notificações → Integrações.
  await page.goto(`/espaco/${slug}/m/notificacoes`);
  await page
    .getByRole("button", { name: /Integrações \(PIX e WhatsApp\)/ })
    .click();
  await page
    .getByPlaceholder("ID da maquininha (opcional)")
    .fill("PDV-TESTE-01");
  await page.getByRole("button", { name: "Salvar PIX" }).click();
  await expect(page.getByRole("button", { name: "Salvo!" })).toBeVisible();
  await page.screenshot({ path: shot("04-config-maquininha"), fullPage: true });

  // PDV: inicia a venda, adiciona o produto e liga "na maquininha".
  await page.goto(`/espaco/${slug}/m/pdv`);
  await page.getByRole("button", { name: "Iniciar venda" }).click();
  await page
    .getByRole("button")
    .filter({ hasText: "Suco Point 1L" })
    .first()
    .click();
  await page.getByText("Cobrar PIX na maquininha").click();
  await page.getByRole("button", { name: "Pix", exact: true }).click();
  await page.getByRole("button", { name: /Finalizar venda/ }).click();

  // Modal de terminal: aviso da maquininha em vez do QR na tela.
  await expect(
    page.getByText("Cobrança enviada para a maquininha"),
  ).toBeVisible();
  await expect(page.getByAltText("QR Code PIX")).toHaveCount(0);
  await page.screenshot({ path: shot("05-modal-maquininha"), fullPage: true });

  await page
    .getByRole("button", { name: /Confirmar pagamento \(simulado\)/ })
    .click();
  await expect(page.getByText(/Venda finalizada/)).toBeVisible({
    timeout: 30_000,
  });

  // Conciliação: a cobrança da maquininha aparece conciliada.
  await page.goto(`/espaco/${slug}/m/financeiro`);
  await page.getByRole("button", { name: "Conciliação PIX" }).click();
  await expect(page.getByText("Conciliado").first()).toBeVisible();
  await page.screenshot({ path: shot("06-conciliacao-maquininha"), fullPage: true });
});
