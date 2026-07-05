import { test, expect } from "@playwright/test";
import { signupWorkspace } from "./helpers";
import {
  mintEmailVerifyToken,
  mintPasswordResetToken,
  isEmailVerified,
  disconnectTokens,
} from "./email-tokens-helper";

/**
 * Fluxo end-to-end de conta:
 *   1. Signup cria o dono (e-mail ainda NÃO verificado).
 *   2. Verificação de e-mail: abre o link (/api/verify-email/[token]) →
 *      redireciona pra /entrar com o banner de sucesso; o banco confirma
 *      emailVerifiedAt.
 *   3. Reset de senha: solicita o link (UI privacy-preserving), abre o link de
 *      redefinição, troca a senha e faz login com a senha NOVA.
 *
 * Os tokens (verificação/reset) são cunhados direto no banco — o app só guarda
 * o hash, então o plain do e-mail (stub em teste) não é recuperável. Ver
 * email-tokens-helper.ts.
 */

const COOKIE = {
  name: "endurance:cookie-consent",
  value: "essential",
  domain: "localhost",
  path: "/",
  sameSite: "Lax" as const,
};

test.beforeEach(async ({ context }) => {
  await context.addCookies([COOKIE]);
});

test.afterAll(async () => {
  await disconnectTokens();
});

test("signup → verificação de e-mail → reset de senha", async ({ page }) => {
  const { email } = await signupWorkspace(page, "E2E Conta SaaS", {
    withCredentials: true,
  });

  // ---- 1. Recém-criado começa não-verificado --------------------------------
  expect(await isEmailVerified(email)).toBe(false);

  // ---- 2. Verificação de e-mail ---------------------------------------------
  // Cenário real: o link chega por e-mail e costuma ser aberto deslogado.
  // Sem a sessão, /entrar não rebate pro espaço e o banner aparece.
  await page.context().clearCookies();
  await page.context().addCookies([COOKIE]);

  const verifyToken = await mintEmailVerifyToken(email);
  await page.goto(`/api/verify-email/${verifyToken}`);
  // O handler redireciona pra /entrar?verify=ok com o banner de sucesso.
  await expect(page).toHaveURL(/\/entrar/);
  await expect(
    page.getByText("E-mail confirmado! Faça login para continuar."),
  ).toBeVisible();
  expect(await isEmailVerified(email)).toBe(true);

  // ---- 3. Reset de senha: solicitação (UI) ----------------------------------
  await page.goto("/recuperar");
  await page.getByPlaceholder("seu@email.com").fill(email);
  await page.getByRole("button", { name: "Enviar link de recuperação" }).click();
  // Resposta é sempre de sucesso (não revela existência da conta).
  await expect(page.getByText("E-mail enviado")).toBeVisible();

  // ---- 3b. Reset de senha: aplicação (link) ---------------------------------
  const newPassword = "novaSenha456";
  const resetToken = await mintPasswordResetToken(email);
  await page.goto(`/redefinir/${resetToken}`);
  await page.getByPlaceholder("Mínimo 8 caracteres com letra e número").fill(newPassword);
  await page.getByPlaceholder("Digite a senha novamente").fill(newPassword);
  await page.getByRole("button", { name: "Redefinir senha" }).click();
  await expect(page.getByText("Senha redefinida")).toBeVisible();

  // ---- 4. Login com a senha NOVA --------------------------------------------
  await page.context().clearCookies();
  await page.context().addCookies([COOKIE]);
  await page.goto("/entrar");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(newPassword);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/espaco\/[^/?#]+/, { timeout: 30_000 });
});
