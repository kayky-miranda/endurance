import { expect, test } from "@playwright/test";
import { uniqueEmail } from "./helpers";

/**
 * Fluxo 1 — Onboarding → workspace.
 * Descreve o negócio, confere a classificação (offline) e os módulos
 * sugeridos, cria a conta e chega ao espaço logado com o menu montado.
 */
test("onboarding cria o workspace com os módulos do nicho", async ({ page }) => {
  await page.goto("/onboarding");

  await page
    .locator("#desc")
    .fill("Tenho um mercadinho de bairro em Campinas, SP.");
  await page.getByRole("button", { name: "Montar meu sistema" }).click();

  // Classificação: nicho de varejo, com a cidade extraída da frase.
  await expect(page.getByText("Encontramos o seu negócio")).toBeVisible();
  await expect(
    page.getByText("Mercado / Varejo", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Campinas/).first()).toBeVisible();

  // Módulos sugeridos: o core e os do nicho aparecem pré-selecionados.
  await expect(
    page.getByText("O essencial — todo negócio usa"),
  ).toBeVisible();
  await expect(page.getByText("Feito para Mercado / Varejo")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /PDV \(frente de caixa\)/ }),
  ).toBeVisible();

  // Conta + espaço.
  await page.getByPlaceholder("Nome do negócio").fill("Mercadinho E2E");
  await page.getByPlaceholder("Seu nome").fill("Dono E2E");
  await page.getByPlaceholder("Seu e-mail").fill(uniqueEmail());
  await page.getByPlaceholder("Senha (mín. 6 caracteres)").fill("segredo123");
  await page.getByRole("button", { name: "Criar meu espaço" }).click();

  // Sessão criada e espaço persistido: cai na visão geral do tenant.
  await page.waitForURL(/\/espaco\/[^/?#]+$/, { timeout: 60_000 });
  await expect(page.getByText(/Bem-vindo/)).toBeVisible();
  await expect(page.getByText("Mercadinho E2E").first()).toBeVisible();

  // O menu de módulos reflete o que foi ativado no onboarding.
  await expect(
    page.getByRole("link", { name: "PDV (frente de caixa)" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Financeiro" }).first(),
  ).toBeVisible();
});
