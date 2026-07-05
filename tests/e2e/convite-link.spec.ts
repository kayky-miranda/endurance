import { test, expect } from "@playwright/test";
import { signupWorkspace, uniqueEmail } from "./helpers";
import { mintInviteToken, disconnectTokens } from "./email-tokens-helper";

/**
 * Fluxo end-to-end de convite por link mágico:
 *   1. Dono cria o espaço (signup).
 *   2. Um convite é emitido para um novo e-mail (token cunhado no banco — o
 *      app só guarda o hash; ver email-tokens-helper.ts).
 *   3. O convidado, em um contexto limpo (sem sessão do dono), abre o link
 *      /convite/[token], completa nome + senha e entra direto no espaço.
 *   4. Reabrir o mesmo link agora mostra "convite já usado" (single-use).
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

test("convite por link — aceitar cria membro e loga no espaço", async ({
  page,
  browser,
}) => {
  // ---- 1. Dono + espaço -----------------------------------------------------
  const { slug } = await signupWorkspace(page, "E2E Convite SaaS", {
    withCredentials: true,
  });

  // ---- 2. Convite emitido para um novo e-mail -------------------------------
  const inviteeEmail = uniqueEmail();
  const token = await mintInviteToken(slug, inviteeEmail);

  // ---- 3. Convidado aceita em contexto limpo --------------------------------
  const guestContext = await browser.newContext();
  await guestContext.addCookies([COOKIE]);
  const guest = await guestContext.newPage();

  await guest.goto(`/convite/${token}`);
  await expect(guest.getByText("Você foi convidado(a)!")).toBeVisible();
  await expect(guest.getByText(inviteeEmail)).toBeVisible();

  await guest.getByPlaceholder("Como você quer ser chamado(a)").fill("Membro E2E");
  await guest.getByPlaceholder("Mínimo 8 chars com letra e número").fill("membro123");
  await guest.getByRole("button", { name: "Aceitar convite e entrar" }).click();

  // No sucesso, a sessão é criada no servidor e o form redireciona pra "/".
  // (O texto "Cadastro concluído" é transitório — some no redirect de 800ms.)
  await guest.waitForURL("http://localhost:3000/", { timeout: 30_000 });

  // ---- 4. Link é single-use -------------------------------------------------
  await guest.goto(`/convite/${token}`);
  await expect(guest.getByText("Convite inválido")).toBeVisible();

  // ---- 5. A sessão do convidado dá acesso ao espaço (não rebate pro login) --
  await guest.goto(`/espaco/${slug}`);
  await expect(guest).toHaveURL(new RegExp(`/espaco/${slug}`));

  await guestContext.close();
});
