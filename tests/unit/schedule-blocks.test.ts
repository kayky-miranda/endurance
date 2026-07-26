import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  isValidBlockKind,
  blockKindLabel,
} from "@/lib/endurance/schedule-block";
import { rangesOverlap } from "@/lib/endurance/scheduling";

describe("schedule-block (puro)", () => {
  it("valida tipos e rótulos", () => {
    expect(isValidBlockKind("almoco")).toBe(true);
    expect(isValidBlockKind("xyz")).toBe(false);
    expect(blockKindLabel("ferias")).toBe("Férias");
    expect(blockKindLabel("desconhecido")).toBe("desconhecido");
  });
});

describe("rangesOverlap", () => {
  const t = (h: number, m = 0) => new Date(2026, 5, 15, h, m).getTime();
  it("detecta sobreposição e respeita meio-aberto", () => {
    expect(rangesOverlap(t(9), t(10), t(9, 30), t(10, 30))).toBe(true);
    expect(rangesOverlap(t(9), t(10), t(10), t(11))).toBe(false); // encosta
    expect(rangesOverlap(t(9), t(10), t(14), t(15))).toBe(false);
  });
});

// --- findBlockConflict com prisma mockado ---
const { prisma } = vi.hoisted(() => ({
  prisma: { scheduleBlock: { findMany: vi.fn() }, user: { findFirst: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ prisma }));

import { findBlockConflict } from "@/lib/endurance/schedule-blocks";

const ORG = "org1";
const at = (h: number, m = 0) => new Date(2026, 5, 15, h, m);

beforeEach(() => vi.clearAllMocks());

describe("findBlockConflict", () => {
  it("acusa conflito quando o atendimento cai sobre um bloqueio do profissional", async () => {
    prisma.scheduleBlock.findMany.mockResolvedValue([
      { id: "b1", professionalId: "p1", professional: "Dr A", kind: "almoco", reason: "Almoço", startsAt: at(12), endsAt: at(13) },
    ]);
    const hit = await findBlockConflict(ORG, "p1", at(12, 30), 30);
    expect(hit?.id).toBe("b1");
    expect(hit?.kindLabel).toBe("Almoço");
  });

  it("não acusa quando encosta na borda (meio-aberto)", async () => {
    prisma.scheduleBlock.findMany.mockResolvedValue([
      { id: "b1", professionalId: "p1", professional: "", kind: "bloqueio", reason: "", startsAt: at(12), endsAt: at(13) },
    ]);
    const hit = await findBlockConflict(ORG, "p1", at(13), 30); // 13:00–13:30
    expect(hit).toBeNull();
  });

  it("bloqueio global (professionalId null) atinge qualquer profissional", async () => {
    prisma.scheduleBlock.findMany.mockResolvedValue([
      { id: "bg", professionalId: null, professional: "", kind: "feriado", reason: "Natal", startsAt: at(0), endsAt: at(23, 59) },
    ]);
    const hit = await findBlockConflict(ORG, "p9", at(10), 60);
    expect(hit?.kind).toBe("feriado");
  });
});
