import { describe, expect, it } from "vitest";
import {
  MODULE_PERMISSION,
  PERMISSIONS,
  PROFILES,
  allPermissionIds,
  canAccessModule,
  effectivePermissions,
  hasPermission,
  isFullAccess,
  modulePermission,
  permissionLabel,
  permissionsForProfile,
  profileLabel,
  sanitizePermissions,
} from "@/lib/endurance/permissions";
import { allModuleIds } from "@/lib/endurance/catalog";

describe("isFullAccess / hasPermission", () => {
  it("OWNER e ADMIN têm acesso total, mesmo sem lista de permissões", () => {
    expect(isFullAccess("OWNER")).toBe(true);
    expect(isFullAccess("ADMIN")).toBe(true);
    expect(hasPermission("OWNER", undefined, "finance.reports")).toBe(true);
    expect(hasPermission("ADMIN", [], "team.manage")).toBe(true);
  });

  it("MEMBER depende da lista explícita", () => {
    expect(isFullAccess("MEMBER")).toBe(false);
    expect(hasPermission("MEMBER", ["pdv.sell"], "pdv.sell")).toBe(true);
    expect(hasPermission("MEMBER", ["pdv.sell"], "finance.reports")).toBe(false);
    expect(hasPermission("MEMBER", undefined, "pdv.sell")).toBe(false);
  });
});

describe("sanitizePermissions / effectivePermissions", () => {
  it("filtra ids inexistentes e remove duplicatas", () => {
    expect(
      sanitizePermissions(["pdv.sell", "pdv.sell", "hacker.root", ""]),
    ).toEqual(["pdv.sell"]);
  });

  it("OWNER/ADMIN recebem o catálogo inteiro; MEMBER recebe a lista sanitizada", () => {
    expect(effectivePermissions("OWNER", undefined)).toEqual(allPermissionIds());
    expect(effectivePermissions("MEMBER", ["stock.manage", "x.y"])).toEqual([
      "stock.manage",
    ]);
    expect(effectivePermissions("MEMBER", undefined)).toEqual([]);
  });
});

describe("canAccessModule (fonte única do gating de módulos)", () => {
  it("módulo mapeado exige a permissão correspondente", () => {
    expect(canAccessModule("MEMBER", [], "financeiro")).toBe(false);
    expect(canAccessModule("MEMBER", ["finance.reports"], "financeiro")).toBe(
      true,
    );
    expect(canAccessModule("OWNER", [], "financeiro")).toBe(true);
  });

  it("módulo sem permissão mapeada é liberado a qualquer papel", () => {
    expect(modulePermission("agenda")).toBeNull();
    expect(canAccessModule("MEMBER", [], "agenda")).toBe(true);
  });
});

describe("coerência do catálogo", () => {
  const validPerms = new Set<string>(allPermissionIds());
  const validModules = new Set(allModuleIds());

  it("ids de permissão são únicos", () => {
    expect(validPerms.size).toBe(PERMISSIONS.length);
  });

  it("todo perfil só referencia permissões existentes", () => {
    for (const p of PROFILES) {
      for (const perm of p.permissions) {
        expect(validPerms.has(perm), `${p.id} → ${perm}`).toBe(true);
      }
    }
  });

  it("o perfil Administrador recebe o catálogo inteiro", () => {
    expect(permissionsForProfile("administrador")).toEqual(allPermissionIds());
  });

  it("MODULE_PERMISSION só aponta para módulos e permissões reais", () => {
    for (const [moduleId, permId] of Object.entries(MODULE_PERMISSION)) {
      expect(validModules.has(moduleId), `módulo ${moduleId}`).toBe(true);
      expect(validPerms.has(permId), `permissão ${permId}`).toBe(true);
    }
  });

  it("rótulos caem em fallback seguro para ids desconhecidos", () => {
    expect(profileLabel("nao-existe")).toBe("Personalizado");
    expect(permissionLabel("nao.existe")).toBe("nao.existe");
    expect(permissionsForProfile("nao-existe")).toEqual([]);
  });
});
