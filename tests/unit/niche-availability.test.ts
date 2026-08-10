import { describe, it, expect } from "vitest";
import {
  NICHES,
  availableNiches,
  isNicheAvailable,
  nicheLabel,
  modulesForNiche,
  activeModuleIds,
  coreModules,
} from "@/lib/endurance/catalog";

/**
 * Academia e Cabeleireiro saíram da OFERTA, não do catálogo.
 *
 * Havia clientes em produção com esses ramos. Apagar o id faria
 * `activeModuleIds` deixar de reconhecê-lo, os módulos sumiriam da barra
 * lateral e `nicheLabel` devolveria o id cru — uma regressão para quem já paga.
 */
describe("ramos fora da oferta", () => {
  it("não aparecem para quem se cadastra agora", () => {
    const ids = availableNiches().map((n) => n.id);
    expect(ids).not.toContain("academia");
    expect(ids).not.toContain("cabelereiro");
    expect(isNicheAvailable("academia")).toBe(false);
    expect(isNicheAvailable("cabelereiro")).toBe(false);
  });

  it("os ramos prontos continuam oferecidos", () => {
    const ids = availableNiches().map((n) => n.id);
    expect(ids).toContain("mercado_varejo");
    expect(ids).toContain("clinica");
    expect(ids).toContain("nutricionista");
    expect(ids).toContain("psicologia");
  });

  it("CONTINUAM no catálogo — quem já escolheu não perde nada", () => {
    expect(NICHES.some((n) => n.id === "academia")).toBe(true);
    expect(NICHES.some((n) => n.id === "cabelereiro")).toBe(true);
  });

  it("o rótulo continua legível para quem já está no ramo", () => {
    // Sem isto a tela mostraria "academia" em vez de "Academia".
    expect(nicheLabel("academia")).toBe("Academia");
    expect(nicheLabel("cabelereiro")).toBe("Cabeleireiro / Salão");
  });

  it("os módulos do ramo continuam resolvendo", () => {
    expect(modulesForNiche("academia").length).toBeGreaterThan(0);
    expect(modulesForNiche("cabelereiro").length).toBeGreaterThan(0);
  });

  it("a empresa que JÁ É academia mantém os módulos ativos", () => {
    // É o teste que prova que a remoção não regrediu ninguém.
    const ativos = activeModuleIds("academia", new Map());
    expect(ativos.has("alunos")).toBe(true);
    expect(ativos.has("treinos")).toBe(true);
    for (const m of coreModules()) expect(ativos.has(m.id)).toBe(true);
  });

  it("ramo desconhecido segue caindo só no núcleo", () => {
    const ativos = activeModuleIds("ramo_que_nao_existe", new Map());
    expect(ativos.has("alunos")).toBe(false);
    expect(ativos.has("pdv")).toBe(false);
    for (const m of coreModules()) expect(ativos.has(m.id)).toBe(true);
  });

  it("a oferta nunca fica vazia", () => {
    expect(availableNiches().length).toBeGreaterThanOrEqual(3);
  });
});
