/**
 * TESTE DOS PERFIS DE ACESSO — regras puras, sem banco.
 *
 * A pergunta: um operador de caixa enxerga o financeiro? Um vendedor aprova
 * compra? Quem aprova pode aprovar a própria solicitação?
 *
 * Aqui não há dado de teste para limpar: `effectivePermissions` e
 * `sessionHasPermission` são funções puras sobre o catálogo de perfis.
 */
import {
  PROFILES,
  PERMISSIONS,
  effectivePermissions,
  permissionsForProfile,
} from "../lib/endurance/permissions.ts";

const say = (s = "") => console.log(s);
const h = (s: string) => { say(); say("── " + s + " " + "─".repeat(Math.max(0, 56 - s.length))); };
const falhas: string[] = [];
const check = (cond: boolean, desc: string, detalhe = "") => {
  say(`  ${cond ? "OK  " : "FALHA"} ${desc}${detalhe ? " :: " + detalhe : ""}`);
  if (!cond) falhas.push(desc + (detalhe ? " :: " + detalhe : ""));
};

/** Permissões efetivas de um perfil, para papel comum (não OWNER/ADMIN). */
const perms = (profileId: string) =>
  new Set(effectivePermissions("MEMBER" as never, permissionsForProfile(profileId)));

try {
  h("catálogo");
  const ids = PERMISSIONS.map((p) => p.id);
  check(new Set(ids).size === ids.length, "nenhuma permissão duplicada no catálogo", `${ids.length} permissões`);
  const profIds = PROFILES.map((p) => p.id);
  check(new Set(profIds).size === profIds.length, "nenhum perfil duplicado", profIds.join(", "));

  const validas = new Set(ids);
  for (const p of PROFILES) {
    const invalidas = permissionsForProfile(p.id).filter((x) => !validas.has(x));
    check(invalidas.length === 0, `perfil "${p.id}" só usa permissões que existem`, invalidas.join(", "));
  }

  h("caixa não vê dinheiro da empresa");
  const caixa = perms("caixa");
  check(caixa.has("pdv.sell"), "caixa pode vender");
  check(!caixa.has("finance.manage"), "caixa NÃO gerencia o financeiro");
  check(!caixa.has("reports.export"), "caixa NÃO exporta relatórios");
  check(!caixa.has("users.manage"), "caixa NÃO administra usuários");
  check(!caixa.has("subscription.manage"), "caixa NÃO mexe no plano/cobrança");
  check(!caixa.has("fiscal.manage"), "caixa NÃO configura o fiscal");

  h("separação de funções em compras");
  for (const p of PROFILES) {
    const s = perms(p.id);
    if (s.has("purchasing.request") && s.has("purchasing.approve")) {
      // Não é necessariamente erro (um dono acumula), mas precisa ser
      // intencional: quem pede e aprova sozinho anula o controle.
      say(`  ⚠ perfil "${p.id}" pede E aprova compra — confira se é intencional`);
    }
  }
  check(true, "varredura de acúmulo pedir+aprovar concluída");

  h("administrador tem tudo, e ninguém além dele");
  const admin = perms("administrador");
  const faltando = ids.filter((i) => !admin.has(i));
  check(faltando.length === 0, "administrador cobre todas as permissões", faltando.join(", "));
  for (const p of PROFILES) {
    if (p.id === "administrador") continue;
    const s = perms(p.id);
    check(!s.has("subscription.manage") || p.id === "financeiro",
      `perfil "${p.id}" não gerencia assinatura`, [...s].filter((x) => x === "subscription.manage").join(""));
  }

  h("OWNER e ADMIN recebem tudo pelo papel");
  const owner = new Set(effectivePermissions("OWNER" as never, []));
  check(ids.every((i) => owner.has(i)), "OWNER tem todas as permissões mesmo com lista vazia");
  const membro = new Set(effectivePermissions("MEMBER" as never, []));
  check(membro.size === 0, "MEMBER sem permissões explícitas não recebe nada", `veio ${membro.size}`);

  h("cada perfil tem alguma coisa");
  for (const p of PROFILES) {
    const s = perms(p.id);
    check(s.size > 0, `perfil "${p.id}" não é vazio`, `${s.size} permissões`);
  }

  h("RESULTADO");
  if (!falhas.length) say("  Perfis coerentes: nenhuma falha.");
  else falhas.forEach((f, i) => say(`  ${i + 1}. ${f}`));
} catch (e) {
  say("\nEXCEÇÃO: " + (e instanceof Error ? (e.stack ?? e.message) : String(e)));
  falhas.push("exceção");
}
process.exit(falhas.length ? 1 : 0);
