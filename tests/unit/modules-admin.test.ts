import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Administração modular: as regras que protegem a navegação — core nunca
 * desliga, só se liga o que existe para algum nicho, e trocar o ramo é aditivo.
 */
const { prisma } = vi.hoisted(() => ({
  prisma: {
    organization: { findUnique: vi.fn(), update: vi.fn() },
    orgModule: { findMany: vi.fn(), upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/db", () => ({ prisma }));

import {
  getModulesConfig,
  setModuleEnabled,
  setOrgNiche,
} from "@/lib/endurance/modules-admin";

const ORG = "org1";

beforeEach(() => {
  vi.clearAllMocks();
  prisma.orgModule.upsert.mockResolvedValue({});
  prisma.organization.update.mockResolvedValue({});
  prisma.$transaction.mockImplementation(async (ops: unknown) =>
    Array.isArray(ops) ? Promise.all(ops) : ops,
  );
});

describe("setModuleEnabled", () => {
  it("recusa desligar um módulo essencial (core)", async () => {
    const res = await setModuleEnabled(ORG, "financeiro", false);
    expect(res.ok).toBe(false);
    expect(prisma.orgModule.upsert).not.toHaveBeenCalled();
  });

  it("recusa módulo desconhecido", async () => {
    const res = await setModuleEnabled(ORG, "modulo_inexistente", true);
    expect(res.ok).toBe(false);
  });

  it("liga um módulo de nicho válido", async () => {
    const res = await setModuleEnabled(ORG, "prontuario", true);
    expect(res.ok).toBe(true);
    expect(prisma.orgModule.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId_moduleId: { organizationId: ORG, moduleId: "prontuario" } },
      }),
    );
  });

  it("permite desligar um módulo de nicho", async () => {
    const res = await setModuleEnabled(ORG, "prontuario", false);
    expect(res.ok).toBe(true);
    expect(prisma.orgModule.upsert.mock.calls[0][0].update.enabled).toBe(false);
  });
});

describe("setOrgNiche", () => {
  it("recusa ramo inválido", async () => {
    const res = await setOrgNiche(ORG, "astronauta");
    expect(res.ok).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("troca o ramo e liga os módulos dele + core (aditivo)", async () => {
    const res = await setOrgNiche(ORG, "psicologia");
    expect(res.ok).toBe(true);
    // 1 update da org + N upserts de módulo, todos enabled:true
    const ops = prisma.$transaction.mock.calls[0][0];
    expect(ops.length).toBeGreaterThan(1);
    const upserts = prisma.orgModule.upsert.mock.calls.map((c) => c[0]);
    expect(upserts.every((u) => u.update.enabled === true)).toBe(true);
    // inclui um módulo de psicologia (prontuario, agora multi-nicho)
    expect(
      upserts.some((u) => u.where.organizationId_moduleId.moduleId === "prontuario"),
    ).toBe(true);
  });
});

describe("getModulesConfig", () => {
  beforeEach(() => {
    prisma.organization.findUnique.mockResolvedValue({
      niche: "psicologia",
      nicheLabel: "Psicologia",
    });
    prisma.orgModule.findMany.mockResolvedValue([
      { moduleId: "prontuario", enabled: true },
      { moduleId: "agenda_consultas", enabled: false },
    ]);
  });

  it("marca core como sempre ligado e não-desligável", async () => {
    const cfg = await getModulesConfig(ORG);
    const all = cfg.categories.flatMap((c) => c.modules);
    const core = all.find((m) => m.id === "financeiro");
    expect(core?.core).toBe(true);
    expect(core?.enabled).toBe(true);
  });

  it("reflete o estado enabled dos módulos de nicho", async () => {
    const all = (await getModulesConfig(ORG)).categories.flatMap((c) => c.modules);
    expect(all.find((m) => m.id === "prontuario")?.enabled).toBe(true);
    expect(all.find((m) => m.id === "agenda_consultas")?.enabled).toBe(false);
  });

  it("marca como recomendado os módulos do ramo atual", async () => {
    const all = (await getModulesConfig(ORG)).categories.flatMap((c) => c.modules);
    // prontuario é multi-nicho incluindo psicologia → recomendado
    expect(all.find((m) => m.id === "prontuario")?.recommended).toBe(true);
  });
});
