import { expect, type Page } from "@playwright/test";
import { mintEmailVerifyToken } from "./email-tokens-helper";

/** Pré-aceita o banner de cookies para ele não interceptar cliques. */
export async function presetCookieConsent(page: Page): Promise<void> {
  await page.context().addCookies([
    {
      name: "endurance:cookie-consent",
      value: "essential",
      domain: "localhost",
      path: "/",
      sameSite: "Lax" as const,
    },
  ]);
}

/**
 * Verifica o e-mail do dono (cunha o token no banco e abre o link). Necessário
 * para fluxos gateados por e-mail verificado, como a emissão de NFC-e.
 */
export async function verifyOwnerEmail(page: Page, email: string): Promise<void> {
  const token = await mintEmailVerifyToken(email);
  // Consome o link via request (mesmo cookie jar) em vez de navegar: o
  // endpoint responde uma cadeia de redirects que abortaria o goto seguinte.
  await page.request.get(`/api/verify-email/${token}`);
}

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

  await presetCookieConsent(page);

  // ---- Etapa 1: conta + empresa -----------------------------------------
  await page.goto("/onboarding");
  await page.locator("#ownerName").fill("Dono E2E");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("#passwordConfirm").fill(password);
  // O espaço herda o nome fantasia, que é o que os specs conferem depois.
  await page.locator("#razaoSocial").fill(`${bizName} LTDA`);
  await page.locator("#nomeFantasia").fill(bizName);
  await page.locator("#segmento").selectOption("Comércio");
  await page.locator("#estado").selectOption("SP");
  await page.locator("#cidade").fill("Campinas");
  await page.getByRole("button", { name: "Continuar" }).click();

  // ---- Etapa 2: descrição + análise -------------------------------------
  await page.waitForURL(/\/onboarding\/empresa$/, { timeout: 60_000 });
  await page
    .locator("#descricao")
    .fill(
      "Tenho um mercadinho de bairro em Campinas, SP. Vendo ao consumidor final e controlo estoque, vendas e financeiro.",
    );
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("Entendemos sua operação")).toBeVisible({
    timeout: 60_000,
  });
  await page.getByRole("button", { name: /Ir para a plataforma/ }).click();

  await page.waitForURL(/\/espaco\/[^/?#]+$/, { timeout: 60_000 });
  const slug = new URL(page.url()).pathname.split("/")[2];
  return opts?.withCredentials ? { slug, email, password } : slug;
}

/**
 * Deixa o estabelecimento apto a emitir NFC-e, pelo wizard real.
 *
 * A emissão é barrada por `blockingForEmission`, que exige bem mais do que
 * CNPJ e razão social: endereço completo, código IBGE, inscrição estadual,
 * CSC e NCM padrão. O spec fiscal preenchia só os dois primeiros e por isso
 * parou de passar quando o gate entrou — o teste ficou para trás da regra,
 * não o contrário.
 *
 * O certificado fica de fora de propósito: na emissão simulada não há o que
 * assinar, e o gate perdoa esse item.
 */
export async function configureFiscal(page: Page, slug: string): Promise<void> {
  const salvar = () => page.getByRole("button", { name: "Salvar etapa" }).click();
  await page.goto(`/espaco/${slug}/estabelecimento`);

  // Etapa "Dados da empresa" — é onde o wizard abre com o cadastro vazio.
  await page.getByLabel("CNPJ").fill("12.345.678/0001-95");
  await page.getByLabel("Razão social").fill("Mercadinho Fluxo Fiscal LTDA");
  await page.getByLabel("Inscrição Estadual").fill("123456789");
  await salvar();

  await page.getByRole("button", { name: /Endereço/ }).first().click();
  await page.getByLabel("CEP").fill("13010-000");
  await page.getByLabel("Logradouro").fill("Rua Treze de Maio");
  await page.getByLabel("Número").fill("100");
  await page.getByLabel("Bairro").fill("Centro");
  await page.getByLabel("Município").fill("Campinas");
  await page.getByLabel("UF").fill("SP");
  await page.getByLabel("Código IBGE").fill("3509502");
  await salvar();

  await page.getByRole("button", { name: /Dados fiscais/ }).first().click();
  // O <label> engloba a dica, então o texto acessível é "CSC" + a dica. Casar
  // pela dica é o que distingue do campo "ID do CSC".
  await page.getByLabel(/^ID do CSC/).fill("000001");
  await page.getByLabel(/Assina o QR Code/).fill("CSC-DE-TESTE-E2E");
  await page.getByLabel(/^NCM padrão dos produtos/).fill("22021000");
  await salvar();
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
