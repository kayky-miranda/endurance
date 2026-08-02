import { describe, it, expect } from "vitest";
import {
  computePendencies,
  tenureLabel,
  sortTimeline,
  DAYS,
  type AppointmentLite,
} from "@/lib/endurance/patient-briefing-rules";

const NOW = new Date("2026-07-28T12:00:00Z");
const ago = (d: number) => new Date(NOW.getTime() - d * DAYS);
const ahead = (d: number) => new Date(NOW.getTime() + d * DAYS);
const appt = (
  startsAt: Date,
  status: string,
  service = "Consulta",
): AppointmentLite => ({ startsAt, status, service });

const base = {
  now: NOW,
  appointments: [] as AppointmentLite[],
  hasAnamnese: true,
  anamneseComplete: true,
  lastMetricAt: null,
  lastPrescriptionAt: null,
};

describe("computePendencies", () => {
  it("paciente em dia não gera pendência", () => {
    const r = computePendencies({
      ...base,
      appointments: [appt(ahead(7), "agendado"), appt(ago(10), "atendido")],
    });
    expect(r).toEqual([]);
  });

  it("faltas consecutivas viram alerta de abandono (prioridade alta)", () => {
    const r = computePendencies({
      ...base,
      appointments: [appt(ago(5), "faltou"), appt(ago(30), "faltou"), appt(ago(60), "atendido")],
    });
    expect(r[0].level).toBe("alta");
    expect(r[0].title).toMatch(/2 faltas consecutivas/);
  });

  it("uma falta isolada não caracteriza abandono", () => {
    const r = computePendencies({
      ...base,
      appointments: [appt(ago(5), "faltou"), appt(ago(30), "atendido"), appt(ahead(3), "agendado")],
    });
    expect(r.some((p) => /faltas consecutivas/.test(p.title))).toBe(false);
  });

  it("sinaliza ausência de retorno agendado após muito tempo", () => {
    const r = computePendencies({ ...base, appointments: [appt(ago(200), "atendido")] });
    const p = r.find((x) => x.title === "Sem retorno agendado");
    expect(p).toBeDefined();
    expect(p!.detail).toContain("200 dias");
  });

  it("não cobra retorno se já existe consulta futura marcada", () => {
    const r = computePendencies({
      ...base,
      appointments: [appt(ahead(5), "agendado"), appt(ago(300), "atendido")],
    });
    expect(r.some((x) => x.title === "Sem retorno agendado")).toBe(false);
  });

  it("consulta futura CANCELADA não conta como retorno marcado", () => {
    const r = computePendencies({
      ...base,
      appointments: [appt(ahead(5), "cancelado"), appt(ago(300), "atendido")],
    });
    expect(r.some((x) => x.title === "Sem retorno agendado")).toBe(true);
  });

  it("distingue anamnese ausente de rascunho", () => {
    const sem = computePendencies({ ...base, hasAnamnese: false });
    expect(sem.find((p) => p.title === "Anamnese não preenchida")?.level).toBe("media");

    const rascunho = computePendencies({ ...base, anamneseComplete: false });
    expect(rascunho.find((p) => p.title === "Anamnese em rascunho")?.level).toBe("baixa");
  });

  it("aponta acompanhamento parado por falta de medições", () => {
    const r = computePendencies({ ...base, lastMetricAt: ago(200) });
    expect(r.some((p) => p.title === "Sem medições recentes")).toBe(true);
    const recente = computePendencies({ ...base, lastMetricAt: ago(20) });
    expect(recente.some((p) => p.title === "Sem medições recentes")).toBe(false);
  });

  it("aponta prescrição antiga sem consulta posterior", () => {
    const r = computePendencies({
      ...base,
      appointments: [appt(ago(200), "atendido")],
      lastPrescriptionAt: ago(190),
    });
    expect(r.some((p) => p.title === "Tratamento sem reavaliação")).toBe(true);
  });

  it("não cobra reavaliação se houve consulta DEPOIS da prescrição", () => {
    const r = computePendencies({
      ...base,
      appointments: [appt(ago(10), "atendido")],
      lastPrescriptionAt: ago(190),
    });
    expect(r.some((p) => p.title === "Tratamento sem reavaliação")).toBe(false);
  });

  it("ordena por gravidade", () => {
    const r = computePendencies({
      ...base,
      appointments: [appt(ago(5), "faltou"), appt(ago(30), "faltou")],
      hasAnamnese: false,
      lastMetricAt: ago(300),
    });
    expect(r.map((p) => p.level)).toEqual(["alta", "media", "baixa"]);
  });
});

describe("tenureLabel", () => {
  it("formata dias, meses e anos", () => {
    expect(tenureLabel(ago(1), NOW)).toBe("1 dia");
    expect(tenureLabel(ago(15), NOW)).toBe("15 dias");
    expect(tenureLabel(ago(90), NOW)).toBe("3 meses");
    expect(tenureLabel(ago(365), NOW)).toBe("1 ano");
    expect(tenureLabel(ago(400), NOW)).toBe("1 ano e 1 mês");
  });

  it("sem marco registrado devolve null", () => {
    expect(tenureLabel(null, NOW)).toBeNull();
  });
});

describe("sortTimeline", () => {
  it("mais recente primeiro", () => {
    const out = sortTimeline([
      { kind: "consulta", at: "2026-01-01T00:00:00.000Z", title: "a" },
      { kind: "anotacao", at: "2026-07-01T00:00:00.000Z", title: "b" },
      { kind: "prescricao", at: "2026-03-01T00:00:00.000Z", title: "c" },
    ]);
    expect(out.map((e) => e.title)).toEqual(["b", "c", "a"]);
  });
});
