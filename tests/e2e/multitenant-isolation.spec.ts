import { test, expect } from "@playwright/test";
import { signupWorkspace } from "./helpers";

/**
 * Isolamento multitenant — o controle mais crítico de um SaaS multiempresa.
 *
 * Garante que o boundary de tenant imposto no layout do espaço
 * (requireOrgAccess: session.slug !== slug → redireciona) realmente impede
 * que o usuário de uma empresa acesse o espaço de outra, e que rotas internas
 * exigem sessão.
 */

const COOKIE = {
  name: "endurance:cookie-consent",
  value: "essential",
  domain: "localhost",
  path: "/",
  sameSite: "Lax" as const,
};

async function freshSession(page: import("@playwright/test").Page) {
  await page.context().clearCookies();
  await page.context().addCookies([COOKIE]);
}

test.beforeEach(async ({ context }) => {
  await context.addCookies([COOKIE]);
});

test("um usuário não acessa o espaço de outra empresa", async ({ page }) => {
  // Org A.
  const a = await signupWorkspace(page, "Org A Isolation", { withCredentials: true });

  // Nova sessão → Org B (fica logado como B).
  await freshSession(page);
  const b = await signupWorkspace(page, "Org B Isolation", { withCredentials: true });
  expect(b.slug).not.toBe(a.slug);

  // Logado como B, tentando o ESPAÇO de A → rebatido para o próprio espaço.
  await page.goto(`/espaco/${a.slug}`);
  await expect(page).toHaveURL(new RegExp(`/espaco/${b.slug}(/|$)`));

  // Rota INTERNA de A (produtos) → mesmo rebote, nunca renderiza dados de A.
  await page.goto(`/espaco/${a.slug}/m/produtos`);
  await expect(page).toHaveURL(new RegExp(`/espaco/${b.slug}(/|$)`));

  // Deslogado → qualquer rota do espaço de A manda para o login.
  await freshSession(page);
  await page.goto(`/espaco/${a.slug}/m/financeiro`);
  await expect(page).toHaveURL(/\/entrar/);
});
