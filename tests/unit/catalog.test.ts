import { describe, expect, it } from "vitest";
import {
  MODULES,
  NICHES,
  allModuleIds,
  coreModules,
  moduleById,
  modulesForNiche,
  nicheLabel,
} from "@/lib/endurance/catalog";

describe("catálogo de módulos", () => {
  it("ids de módulo são únicos", () => {
    const ids = allModuleIds();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("moduleById resolve todos os ids do catálogo", () => {
    for (const id of allModuleIds()) {
      expect(moduleById(id)?.id).toBe(id);
    }
    expect(moduleById("nao-existe")).toBeUndefined();
  });

  it("coreModules são exatamente os de escopo core", () => {
    for (const m of coreModules()) expect(m.scope).toBe("core");
    expect(coreModules().length).toBe(
      MODULES.filter((m) => m.scope === "core").length,
    );
  });

  it("todo nicho tem módulos próprios e eles declaram o nicho no escopo", () => {
    for (const n of NICHES) {
      const mods = modulesForNiche(n.id);
      expect(mods.length).toBeGreaterThan(0);
      for (const m of mods) {
        expect(Array.isArray(m.scope) && m.scope.includes(n.id)).toBe(true);
      }
    }
  });

  it("nicheLabel cobre nichos, 'outro' e ids desconhecidos", () => {
    expect(nicheLabel("mercado_varejo")).toBe("Mercado / Varejo");
    expect(nicheLabel("outro")).toBe("Outro / não identificado");
  });
});
