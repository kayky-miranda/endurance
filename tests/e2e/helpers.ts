import { expect, type Page } from "@playwright/test";

/**
 * Domínio reservado dos donos criados pelos E2E. O global-teardown apaga as
 * organizações cujo usuário tem e-mail neste domínio (cascade limpa o resto).
 */
export const E2E_EMAIL_DOMAIN = "e2e.endurance.test";

export function uniqueEmail(): string {
  return `owner-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@${E2E_EMAIL_DOMAIN}`;
}

/**
 * Cria um espaço novo pelo onboarding real (classificador offline) e devolve o
 * slug + credenciais usadas (úteis pra fluxos que precisam relogar).
 * Deixa a sessão do dono logada no contexto da página.
 */
export async function signupWorkspace(
  page: Page,
  bizName: string,
): Promise<string>;
export async function signupWorkspace(
  page: Page,
  bizName: string,
  opts: { withCredentials: true },
): Promise<{ slug: string; email: string; password: string }>;
export async function signupWorkspace(
  page: Page,
  bizName: string,
  opts?: { withCredentials?: boolean },
): Promise<string | { slug: string; email: string; password: string }> {
  const email = uniqueEmail();
  const password = "segredo123";

  await page.goto("/onboarding");
  await page
    .locator("#desc")
    .fill("Tenho um mercadinho de bairro em Campinas, SP.");
  await page.getByRole("button", { name: "Montar meu sistema" }).click();

  await expect(page.getByText("Encontramos o seu negócio")).toBeVisible();

  await page.getByPlaceholder("Nome do negócio").fill(bizName);
  await page.getByPlaceholder("Seu nome").fill("Dono E2E");
  await page.getByPlaceholder("Seu e-mail").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Criar meu espaço" }).click();

  await page.waitForURL(/\/espaco\/[^/?#]+$/, { timeout: 60_000 });
  const slug = new URL(page.url()).pathname.split("/")[2];
  return opts?.withCredentials ? { slug, email, password } : slug;
}

/** Cadastra um produto pela tela de produtos. */
export async function createProduct(
  page: Page,
  slug: string,
  p: { name: string; price: string; stock: string },
): Promise<void> {
  await page.goto(`/espaco/${slug}/m/produtos`);
  await page.getByPlaceholder("Nome do produto").fill(p.name);
  await page.getByPlaceholder("Preço (R$)").fill(p.price);
  await page.getByPlaceholder("Estoque inicial").fill(p.stock);
  await page.getByRole("button", { name: "Adicionar produto" }).click();
  // O formulário limpa ao salvar; o nome passa a existir na tabela.
  await expect(page.getByPlaceholder("Nome do produto")).toHaveValue("");
  await expect(page.getByText(p.name)).toBeVisible();
}

/** Vende 1 unidade do produto no PDV, paga em dinheiro e finaliza. */
export async function sellOneInCash(
  page: Page,
  slug: string,
  productName: string,
): Promise<void> {
  await page.goto(`/espaco/${slug}/m/pdv`);
  await page.getByRole("button", { name: "Iniciar venda" }).click();
  await page
    .getByRole("button")
    .filter({ hasText: productName })
    .first()
    .click();
  await page.getByRole("button", { name: "Dinheiro", exact: true }).click();
  await page.getByRole("button", { name: /Finalizar venda/ }).click();
  await expect(page.getByText(/Venda finalizada/)).toBeVisible();
}
