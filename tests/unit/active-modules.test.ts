import { describe, it, expect } from "vitest";
import { activeModuleIds, coreModules, modulesForNiche } from "@/lib/endurance/catalog";

/**
 * Regra central do provisionamento: ausência de linha em OrgModule significa
 * "nunca provisionado" (o catálogo cresceu), NÃO "desligado". Era o que fazia
 * módulos novos — como o Cadastro de pacientes — sumirem para empresas antigas.
 */
describe("activeModuleIds", () => {
  const CORE = coreModules().map((m) => m.id);

  it("espaço sem nenhuma configuração recebe os core + os do ramo", () => {
    const active = activeModuleIds("nutricionista", new Map());
    for (const id of CORE) expect(active.has(id)).toBe(true);
    for (const m of modulesForNiche("nutricionista")) {
      expect(active.has(m.id)).toBe(true);
    }
    // O Cadastro de pacientes é do nicho de saúde — o caso do bug.
    expect(active.has("pacientes")).toBe(true);
  });

  it("REGRESSÃO: módulo desligado de propósito continua desligado", () => {
    const active = activeModuleIds(
      "nutricionista",
      new Map([["pacientes", false]]),
    );
    expect(active.has("pacientes")).toBe(false);
  });

  it("módulo fora do ramo não entra sozinho, mas entra se ligado à mão", () => {
    const semPdv = activeModuleIds("nutricionista", new Map());
    expect(semPdv.has("pdv")).toBe(false);

    const comPdv = activeModuleIds("nutricionista", new Map([["pdv", true]]));
    expect(comPdv.has("pdv")).toBe(true);
  });

  it("varejo não ganha módulos clínicos por engano", () => {
    const active = activeModuleIds("mercado_varejo", new Map());
    expect(active.has("pacientes")).toBe(false);
    expect(active.has("prontuario")).toBe(false);
    expect(active.has("pdv")).toBe(true);
  });

  it("nicho desconhecido ainda recebe os módulos essenciais", () => {
    const active = activeModuleIds("ramo_inexistente", new Map());
    for (const id of CORE) expect(active.has(id)).toBe(true);
  });

  it("linha enabled=true vale mesmo fora do padrão do ramo", () => {
    const active = activeModuleIds("mercado_varejo", new Map([["pacientes", true]]));
    expect(active.has("pacientes")).toBe(true);
  });
});
