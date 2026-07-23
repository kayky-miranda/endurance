import { describe, it, expect, beforeEach, vi } from "vitest";
import { anamneseTemplate } from "@/lib/endurance/anamnese-templates";

describe("anamneseTemplate", () => {
  it("dá o modelo do nicho e cai no comum p/ nicho sem modelo", () => {
    expect(anamneseTemplate("nutricionista")).toContain(
      "Consumo de água por dia",
    );
    expect(anamneseTemplate("psicologia")).toContain("Demanda / o que traz à terapia");
    // nicho de varejo não tem modelo → volta o comum (tem queixa principal)
    const varejo = anamneseTemplate("mercado_varejo");
    expect(varejo).toContain("Queixa principal / motivo da consulta");
    expect(varejo).not.toContain("Consumo de água por dia");
    expect(anamneseTemplate(undefined).length).toBeGreaterThan(0);
  });
});

// --- Serviço com prisma mockado ---
const { prisma } = vi.hoisted(() => ({
  prisma: {
    customer: { findFirst: vi.fn() },
    organization: { findUnique: vi.fn() },
    anamnese: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    anamneseItem: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/db", () => ({ prisma }));

import {
  getOrInitAnamnese,
  saveAnamnese,
  deleteAnamnese,
} from "@/lib/endurance/anamnese";

const ORG = "org1";
const ACTOR = { id: "u1", name: "Dra. Ana" };

beforeEach(() => {
  vi.clearAllMocks();
  prisma.anamnese.create.mockResolvedValue({ id: "an1" });
  prisma.anamnese.update.mockResolvedValue({});
  prisma.$transaction.mockResolvedValue([]);
});

describe("getOrInitAnamnese", () => {
  it("paciente inexistente → null", async () => {
    prisma.customer.findFirst.mockResolvedValue(null);
    expect(await getOrInitAnamnese(ORG, "c1")).toBeNull();
  });

  it("sem anamnese → semeia o modelo do nicho, sem gravar", async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: "c1" });
    prisma.anamnese.findFirst.mockResolvedValue(null);
    prisma.organization.findUnique.mockResolvedValue({ niche: "nutricionista" });
    const data = await getOrInitAnamnese(ORG, "c1");
    expect(data!.exists).toBe(false);
    expect(data!.id).toBeNull();
    expect(data!.items.length).toBeGreaterThan(5);
    expect(prisma.anamnese.create).not.toHaveBeenCalled();
  });

  it("com anamnese → devolve os itens salvos", async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: "c1" });
    prisma.anamnese.findFirst.mockResolvedValue({
      id: "an1",
      status: "concluida",
      createdByName: "Ana",
      updatedAt: new Date(),
      items: [{ question: "Q1", answer: "A1", position: 0 }],
    });
    const data = await getOrInitAnamnese(ORG, "c1");
    expect(data!.exists).toBe(true);
    expect(data!.status).toBe("concluida");
    expect(data!.items[0].answer).toBe("A1");
  });
});

describe("saveAnamnese", () => {
  it("recusa quando todas as linhas estão vazias", async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: "c1" });
    const res = await saveAnamnese(ORG, ACTOR, {
      customerId: "c1",
      items: [{ question: "  ", answer: "" }],
    });
    expect(res.ok).toBe(false);
  });

  it("cria quando não existe, com status padrão rascunho", async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: "c1" });
    prisma.anamnese.findFirst.mockResolvedValue(null);
    const res = await saveAnamnese(ORG, ACTOR, {
      customerId: "c1",
      items: [{ question: "Queixa", answer: "Dor" }],
    });
    expect(res.ok).toBe(true);
    expect(prisma.anamnese.create.mock.calls[0][0].data.status).toBe("rascunho");
  });

  it("atualiza (substitui itens) quando já existe", async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: "c1" });
    prisma.anamnese.findFirst.mockResolvedValue({ id: "an1" });
    const res = await saveAnamnese(ORG, ACTOR, {
      customerId: "c1",
      status: "concluida",
      items: [{ question: "Q", answer: "R" }],
    });
    expect(res.ok).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.anamneseItem.deleteMany).toHaveBeenCalledWith({
      where: { anamneseId: "an1" },
    });
  });
});

describe("deleteAnamnese", () => {
  it("faz exclusão LÓGICA (deletedAt)", async () => {
    prisma.anamnese.findFirst.mockResolvedValue({ id: "an1" });
    const res = await deleteAnamnese(ORG, "c1");
    expect(res.ok).toBe(true);
    expect(prisma.anamnese.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
  });
});
