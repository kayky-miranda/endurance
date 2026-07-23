import { describe, it, expect } from "vitest";
import { hasPermission } from "@/lib/endurance/permissions";

/**
 * Escopo por registro no painel: quem NÃO tem `sales.view_all` deve ser
 * limitado às próprias vendas. A regra de decisão é hasPermission — OWNER e
 * ADMIN veem tudo; MEMBER depende da permissão explícita.
 */
describe("sales.view_all — quem vê as vendas da equipe", () => {
  it("OWNER vê tudo (acesso total)", () => {
    expect(hasPermission("OWNER", [], "sales.view_all")).toBe(true);
  });

  it("ADMIN vê tudo (acesso total)", () => {
    expect(hasPermission("ADMIN", undefined, "sales.view_all")).toBe(true);
  });

  it("MEMBER com a permissão vê a equipe", () => {
    expect(hasPermission("MEMBER", ["sales.view_all"], "sales.view_all")).toBe(true);
  });

  it("MEMBER sem a permissão é escopado (vê só as próprias)", () => {
    expect(hasPermission("MEMBER", ["pdv.sell"], "sales.view_all")).toBe(false);
  });

  it("vendedor (só pdv.sell + customers.manage) não vê a equipe", () => {
    const vendedor = ["pdv.sell", "customers.manage"];
    expect(hasPermission("MEMBER", vendedor, "sales.view_all")).toBe(false);
  });
});
