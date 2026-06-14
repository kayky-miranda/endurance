import { expect, test } from "@playwright/test";
import path from "path";
import { createProduct, sellOneInCash, signupWorkspace } from "./helpers";

const shot = (name: string) =>
  path.join(process.cwd(), "pix-screens", `${name}.png`);

/**
 * Recibo por WhatsApp (modo simulado) + cadastro do cliente.
 * Vende sem identificar o cliente; ao enviar o recibo informando o telefone, o
 * cliente é CADASTRADO no CRM e vinculado à venda.
 */
test("envia recibo no WhatsApp e cadastra o cliente", async ({ page }) => {
  const slug = await signupWorkspace(page, "Mercadinho Recibo E2E");
  await createProduct(page, slug, {
    name: "Bolacha Recibo",
    price: "7",
    stock: "5",
  });

  // Venda em dinheiro, sem cliente identificado.
  await sellOneInCash(page, slug, "Bolacha Recibo");

  // Tela pós-venda: informa o WhatsApp e envia o recibo.
  const phone = "11988887777";
  await page.getByPlaceholder("WhatsApp do cliente").fill(phone);
  await page.getByRole("button", { name: /Enviar recibo/ }).click();
  await expect(page.getByText(/Recibo .* no WhatsApp/)).toBeVisible();
  await page.screenshot({ path: shot("07-recibo-enviado"), fullPage: true });

  // CRM: o cliente foi cadastrado com o telefone do recibo.
  await page.goto(`/espaco/${slug}/m/crm`);
  await expect(page.getByText(phone)).toBeVisible();
});
