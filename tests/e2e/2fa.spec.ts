import { test, expect } from "@playwright/test";
import { signupWorkspace } from "./helpers";
import { totpCode } from "./totp-test-helper";

/**
 * Fluxo end-to-end de 2FA:
 *   1. Signup cria conta sem 2FA.
 *   2. Ativa 2FA em /conta: começa → captura secret → confirma com código real.
 *   3. Captura os 8 backup codes exibidos uma única vez.
 *   4. Logout → tenta login: pede TOTP.
 *   5. Submete código TOTP gerado em tempo real, entra no /espaco.
 *   6. Logout de novo → login com backup code → entra. Segundo uso do mesmo
 *      backup code é rejeitado.
 */
test.beforeEach(async ({ context }) => {
  // Pre-aceita o banner de cookies pra não interceptar cliques durante o teste.
  await context.addCookies([
    {
      name: "endurance:cookie-consent",
      value: "essential",
      domain: "localhost",
      path: "/",
      sameSite: "Lax",
    },
  ]);
});

test("2FA TOTP — ativar, login com código e backup code single-use", async ({ page }) => {
  const { slug, email, password } = await signupWorkspace(page, "E2E 2FA SaaS", {
    withCredentials: true,
  });

  // ---------- 1. Ativa 2FA em /conta -------------------------------------
  await page.goto(`/espaco/${slug}/conta`);
  await page.getByRole("button", { name: "Ativar 2FA" }).click();
  await page.getByRole("button", { name: "Começar" }).click();

  // Captura o secret do bloco "Digite o código manualmente" (fica num <code>).
  await page.getByText("Digite o código manualmente").click();
  const rawSecret = await page
    .locator("code")
    .filter({ hasText: /^[A-Z2-7]+$/ })
    .first()
    .textContent();
  expect(rawSecret).toBeTruthy();
  const secret = rawSecret!.trim();
  const firstTotp = totpCode(secret);

  await page.getByPlaceholder("000000").fill(firstTotp);
  await page.getByRole("button", { name: "Confirmar e ativar" }).click();
  await expect(page.getByText("2FA ativado")).toBeVisible();

  // ---------- 2. Captura backup codes ------------------------------------
  // Cada código está num <span> com texto XXXX-XXXX (hex).
  const codeNodes = page.locator("span").filter({ hasText: /^[0-9A-F]{4}-[0-9A-F]{4}$/ });
  await expect(codeNodes.first()).toBeVisible();
  const backupCodes = await codeNodes.allTextContents();
  expect(backupCodes.length).toBeGreaterThanOrEqual(8);
  const firstBackup = backupCodes[0];

  await page.getByRole("button", { name: "Concluir" }).click();

  // ---------- 3. Logout ---------------------------------------------------
  await page.getByRole("button", { name: "Sair" }).click();
  await page.waitForURL(/\/(entrar)?$/);

  // ---------- 4. Login com senha → tela TOTP ------------------------------
  await page.goto("/entrar");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();

  // O LoginForm troca de fase pra "totp" sem navegar.
  await expect(page.getByText("Senha confirmada")).toBeVisible({ timeout: 15_000 });

  // ---------- 5. Submete TOTP correto e entra no espaço -------------------
  const loginTotp = totpCode(secret);
  await page.getByPlaceholder("000000").fill(loginTotp);
  await page.getByRole("button", { name: /Verificar e entrar/ }).click();
  await page.waitForURL(/\/espaco\/[^/?#]+$/, { timeout: 30_000 });
  expect(page.url()).toContain(`/espaco/${slug}`);

  // ---------- 6. Logout → login com backup code ---------------------------
  await page.getByRole("button", { name: "Sair" }).click();
  await page.waitForURL(/\/(entrar)?$/);
  await page.goto("/entrar");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Senha confirmada")).toBeVisible({ timeout: 15_000 });

  // Troca pra modo backup code.
  await page.getByRole("button", { name: "Usar código de recuperação" }).click();
  await page.getByPlaceholder("XXXX-XXXX").fill(firstBackup);
  await page.getByRole("button", { name: /Verificar e entrar/ }).click();
  await page.waitForURL(/\/espaco\/[^/?#]+$/, { timeout: 30_000 });

  // ---------- 7. Segundo uso do MESMO backup code é rejeitado -------------
  await page.getByRole("button", { name: "Sair" }).click();
  await page.waitForURL(/\/(entrar)?$/);
  await page.goto("/entrar");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Senha confirmada")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Usar código de recuperação" }).click();
  await page.getByPlaceholder("XXXX-XXXX").fill(firstBackup);
  await page.getByRole("button", { name: /Verificar e entrar/ }).click();
  await expect(page.getByText(/Código de recuperação inválido/)).toBeVisible({
    timeout: 15_000,
  });
});
