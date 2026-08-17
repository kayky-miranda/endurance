import { test, expect } from "@playwright/test";
import { signupWorkspace, verifyOwnerEmail } from "./helpers";

/**
 * VARREDURA DE ROTAS: abre todas as telas do espaço e procura quebra.
 *
 * Não valida regra de negócio — valida que a tela ABRE. Erro 500, fronteira de
 * erro do React ou página vazia aparecem aqui antes de aparecerem para o
 * cliente. É o teste que cobre a maior superfície pelo menor custo.
 */

/** Rotas de um espaço de varejo, que é o ramo com mais módulos ligados. */
const ROTAS = [
  "", // visão geral
  "estabelecimento",
  "auditoria",
  "configuracoes",
  "m/relatorios",
  "m/financeiro",
  "m/crm",
  "m/marketing",
  "m/notificacoes",
  "m/importacao",
  "m/pdv",
  "m/caixa",
  "m/produtos",
  "m/precificacao",
  "m/estoque",
  "m/movimentacoes",
  "m/transferencias",
  "m/conferencia",
  "m/codigo_barras",
  "m/fornecedores",
  "m/compras",
  "m/solicitacoes",
  "m/aprovacoes",
  "m/cotacoes",
  "m/pedidos_compra",
  "m/recebimento",
  "m/nfce",
  "m/nfe",
];

test("todas as telas do espaço abrem sem quebrar", async ({ page }) => {
  test.setTimeout(600_000);

  const erros: string[] = [];
  const consoleErros: string[] = [];
  page.on("pageerror", (e) => consoleErros.push(e.message.slice(0, 120)));

  const { slug, email } = await signupWorkspace(page, "Varredura Rotas", {
    withCredentials: true,
  });
  await verifyOwnerEmail(page, email);

  for (const rota of ROTAS) {
    const url = `/espaco/${slug}${rota ? "/" + rota : ""}`;
    consoleErros.length = 0;

    const resp = await page.goto(url, { waitUntil: "domcontentloaded" });
    const status = resp?.status() ?? 0;
    await page.waitForLoadState("networkidle").catch(() => {});

    const texto = await page.locator("body").innerText().catch(() => "");
    const quebrou =
      /Algo deu errado|Application error|Internal Server Error|This page could not be found/i.test(
        texto,
      );
    const vazio = texto.trim().length < 40;

    const problema =
      status >= 400
        ? `HTTP ${status}`
        : quebrou
          ? "fronteira de erro"
          : vazio
            ? `tela vazia (${texto.trim().length} chars)`
            : consoleErros.length
              ? `erro de JS: ${consoleErros[0]}`
              : "";

    console.log(`  ${problema ? "FALHA" : "ok   "} ${url}${problema ? " :: " + problema : ""}`);
    if (problema) erros.push(`${url} :: ${problema}`);
  }

  console.log("\n=== RESULTADO DA VARREDURA ===");
  if (!erros.length) console.log(`  ${ROTAS.length} telas abriram sem quebrar.`);
  else erros.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));

  expect(erros).toEqual([]);
});
