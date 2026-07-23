import { describe, it, expect } from "vitest";
import {
  isValidStatus,
  isBlockingStatus,
  canTransition,
  overlaps,
  dayRange,
  toDateInput,
} from "@/lib/endurance/scheduling";

describe("isValidStatus", () => {
  it("aceita os status conhecidos e rejeita o resto", () => {
    expect(isValidStatus("agendado")).toBe(true);
    expect(isValidStatus("atendido")).toBe(true);
    expect(isValidStatus("qualquer")).toBe(false);
    expect(isValidStatus("")).toBe(false);
  });
});

describe("canTransition", () => {
  it("permite o fluxo normal agendado→confirmado→atendido", () => {
    expect(canTransition("agendado", "confirmado")).toBe(true);
    expect(canTransition("confirmado", "atendido")).toBe(true);
  });
  it("trata o mesmo status como no-op válido", () => {
    expect(canTransition("agendado", "agendado")).toBe(true);
  });
  it("bloqueia sair de um estado final (atendido/cancelado)", () => {
    expect(canTransition("atendido", "agendado")).toBe(false);
    expect(canTransition("cancelado", "agendado")).toBe(false);
  });
  it("permite remarcar quem faltou", () => {
    expect(canTransition("faltou", "agendado")).toBe(true);
  });
});

describe("isBlockingStatus", () => {
  it("cancelado não ocupa a agenda; os demais ocupam", () => {
    expect(isBlockingStatus("cancelado")).toBe(false);
    expect(isBlockingStatus("agendado")).toBe(true);
    expect(isBlockingStatus("atendido")).toBe(true);
  });
});

describe("overlaps", () => {
  const t = (h: number, m = 0) => new Date(2026, 0, 1, h, m).getTime();
  it("detecta sobreposição parcial", () => {
    // 09:00–10:00 vs 09:30–10:30
    expect(overlaps(t(9), 60, t(9, 30), 60)).toBe(true);
  });
  it("não conflita quando um começa exatamente quando o outro termina", () => {
    // 09:00–10:00 vs 10:00–11:00 (meio-aberto)
    expect(overlaps(t(9), 60, t(10), 60)).toBe(false);
  });
  it("não conflita horários totalmente separados", () => {
    expect(overlaps(t(9), 30, t(14), 30)).toBe(false);
  });
  it("detecta um contido no outro", () => {
    expect(overlaps(t(9), 120, t(9, 30), 15)).toBe(true);
  });
});

describe("dayRange", () => {
  it("cobre exatamente 24h a partir da meia-noite local", () => {
    const { start, end } = dayRange("2026-03-15");
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(2);
    expect(start.getDate()).toBe(15);
    expect(start.getHours()).toBe(0);
    expect(end.getTime() - start.getTime()).toBe(86_400_000);
  });
  it("data inválida cai para hoje sem quebrar", () => {
    const { start, end } = dayRange("xx");
    expect(end.getTime() - start.getTime()).toBe(86_400_000);
  });
});

describe("toDateInput", () => {
  it("formata YYYY-MM-DD com zero à esquerda no fuso local", () => {
    expect(toDateInput(new Date(2026, 2, 5))).toBe("2026-03-05");
    expect(toDateInput(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});
