import { expect, test } from "@playwright/test";
import { uniqueEmail, presetCookieConsent } from "./helpers";

/**
 * Fluxo 1 — Onboarding em duas etapas → workspace.
 *
 * Etapa 1 cria conta e empresa; etapa 2 lê a descrição, mostra o que foi
 * entendido e liga os módulos. A conta passa a existir ANTES da análise: quem
 * abandona no meio não perde o cadastro, que era o caso quando a análise vinha
 * primeiro.
 */
test("onboarding em duas etapas cria o workspace com os módulos do nicho", async ({
  page,
}) => {
  await presetCookieConsent(page);
  await page.goto("/onboarding");

  // ---- Etapa 1: conta + empresa -----------------------------------------
  await expect(page.getByText("Sua gestão começa aqui.")).toBeVisible();
  // Pelo papel, não pelo texto: o <title> da página também casa com a frase.
  await expect(
    page.getByRole("heading", { name: "Crie sua conta" }),
  ).toBeVisible();

  await page.locator("#ownerName").fill("Dono E2E");
  await page.locator("#email").fill(uniqueEmail());
  await page.locator("#password").fill("segredo123");
  await page.locator("#passwordConfirm").fill("segredo123");
  await page.locator("#razaoSocial").fill("Mercadinho E2E LTDA");
  await page.locator("#nomeFantasia").fill("Mercadinho E2E");
  await page.locator("#segmento").selectOption("Comércio");
  await page.locator("#estado").selectOption("SP");
  await page.locator("#cidade").fill("Campinas");
  await page.getByRole("button", { name: "Continuar" }).click();

  // ---- Etapa 2: descrição -----------------------------------------------
  await page.waitForURL(/\/onboarding\/empresa$/, { timeout: 60_000 });
  await expect(page.getByText("Conte um pouco sobre sua empresa")).toBeVisible();
  await page
    .locator("#descricao")
    .fill(
      "Tenho um mercadinho de bairro em Campinas, SP. Vendo ao consumidor final e controlo estoque, vendas e financeiro.",
    );
  await page.getByRole("button", { name: "Continuar" }).click();

  // ---- Análise: só afirma o que saiu da descrição ------------------------
  await expect(page.getByText("Entendemos sua operação")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText("Comércio", { exact: true })).toBeVisible();
  await expect(page.getByText("B2C", { exact: true })).toBeVisible();
  await expect(page.getByText(/Estoque/).first()).toBeVisible();

  await page.getByRole("button", { name: /Ir para a plataforma/ }).click();

  // ---- Espaço criado, com o menu montado --------------------------------
  await page.waitForURL(/\/espaco\/[^/?#]+$/, { timeout: 60_000 });
  await expect(page.getByText(/Bem-vindo/)).toBeVisible();
  await expect(page.getByText("Mercadinho E2E").first()).toBeVisible();
  await expect(
    page.getByRole("link", { name: "PDV (frente de caixa)" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Financeiro" }).first(),
  ).toBeVisible();
});

test("a etapa 2 exige sessão: sem conta, volta para o cadastro", async ({
  page,
}) => {
  await presetCookieConsent(page);
  await page.goto("/onboarding/empresa");
  await expect(page).toHaveURL(/\/onboarding$/);
});
