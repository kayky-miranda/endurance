import { describe, it, expect } from "vitest";
import {
  isValidStatus,
  isBlockingStatus,
  canTransition,
  overlaps,
  dayRange,
  toDateInput,
  addDays,
  startOfWeek,
  weekDays,
  monthGridDays,
  minutesSinceMidnight,
  isSameDay,
  recurrenceDates,
  isValidRecurrenceFreq,
  MAX_RECURRENCE,
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

describe("addDays", () => {
  it("soma dias atravessando fim de mês sem drift", () => {
    expect(toDateInput(addDays(new Date(2026, 0, 30), 3))).toBe("2026-02-02");
    expect(toDateInput(addDays(new Date(2026, 0, 1), -1))).toBe("2025-12-31");
  });
});

describe("startOfWeek / weekDays", () => {
  it("início no domingo (padrão) da semana que contém a data", () => {
    // 2026-06-17 é uma quarta-feira → domingo da semana é 2026-06-14
    expect(toDateInput(startOfWeek(new Date(2026, 5, 17)))).toBe("2026-06-14");
  });
  it("início na segunda quando weekStartsOn=1", () => {
    expect(toDateInput(startOfWeek(new Date(2026, 5, 17), 1))).toBe("2026-06-15");
  });
  it("weekDays devolve 7 dias consecutivos", () => {
    const days = weekDays(new Date(2026, 5, 17)).map(toDateInput);
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-06-14");
    expect(days[6]).toBe("2026-06-20");
  });
});

describe("monthGridDays", () => {
  it("devolve 42 dias cobrindo o mês, iniciando no domingo", () => {
    const grid = monthGridDays(new Date(2026, 5, 15)); // junho/2026
    expect(grid).toHaveLength(42);
    // 1º de junho/2026 é segunda → a grade começa no domingo 31/05
    expect(toDateInput(grid[0])).toBe("2026-05-31");
    expect(grid.some((d) => toDateInput(d) === "2026-06-01")).toBe(true);
    expect(grid.some((d) => toDateInput(d) === "2026-06-30")).toBe(true);
  });
});

describe("recurrenceDates", () => {
  const start = new Date(2026, 0, 5, 9, 30); // 05/01/2026 09:30 (segunda)

  it("semanal soma 7 dias e preserva a hora", () => {
    const d = recurrenceDates(start, "semanal", 3);
    expect(d.map(toDateInput)).toEqual(["2026-01-05", "2026-01-12", "2026-01-19"]);
    expect(d[1].getHours()).toBe(9);
    expect(d[1].getMinutes()).toBe(30);
  });

  it("quinzenal soma 14 dias", () => {
    const d = recurrenceDates(start, "quinzenal", 3);
    expect(d.map(toDateInput)).toEqual(["2026-01-05", "2026-01-19", "2026-02-02"]);
  });

  it("mensal mantém o dia entre meses", () => {
    const d = recurrenceDates(start, "mensal", 3);
    expect(d.map(toDateInput)).toEqual(["2026-01-05", "2026-02-05", "2026-03-05"]);
  });

  it("mensal ajusta para o último dia em meses curtos", () => {
    // 31/01 → fevereiro não tem 31 → 28/02/2026
    const d = recurrenceDates(new Date(2026, 0, 31, 8, 0), "mensal", 2);
    expect(toDateInput(d[1])).toBe("2026-02-28");
  });

  it("clampa a contagem em [1, MAX_RECURRENCE]", () => {
    expect(recurrenceDates(start, "semanal", 0)).toHaveLength(1);
    expect(recurrenceDates(start, "semanal", 999)).toHaveLength(MAX_RECURRENCE);
  });

  it("isValidRecurrenceFreq valida as frequências", () => {
    expect(isValidRecurrenceFreq("mensal")).toBe(true);
    expect(isValidRecurrenceFreq("anual")).toBe(false);
  });
});

describe("minutesSinceMidnight / isSameDay", () => {
  it("minutos desde a meia-noite", () => {
    expect(minutesSinceMidnight(new Date(2026, 5, 15, 9, 30))).toBe(570);
    expect(minutesSinceMidnight(new Date(2026, 5, 15, 0, 0))).toBe(0);
  });
  it("isSameDay ignora horas", () => {
    expect(isSameDay(new Date(2026, 5, 15, 8), new Date(2026, 5, 15, 20))).toBe(true);
    expect(isSameDay(new Date(2026, 5, 15), new Date(2026, 5, 16))).toBe(false);
  });
});
