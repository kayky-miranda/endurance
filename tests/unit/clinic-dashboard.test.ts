import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Painel da clínica: as regras de agregação — retrato do dia, faturamento por
 * consulta atendida, taxa de faltas, ocupação e ranking — verificadas com um
 * relógio fixo e prisma mockado (dados determinísticos).
 */
const { prisma } = vi.hoisted(() => ({
  prisma: {
    appointment: { findMany: vi.fn(), aggregate: vi.fn() },
    customer: { count: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma }));

import { getClinicDashboard, isHealthNiche } from "@/lib/endurance/clinic-dashboard";

const ORG = "org1";
// Relógio fixo: 2026-06-15 10:00 (local).
const NOW = new Date(2026, 5, 15, 10, 0, 0);
const at = (h: number, m = 0) => new Date(2026, 5, 15, h, m, 0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.clearAllMocks();

  const todays = [
    { id: "t1", startsAt: at(9, 0), durationMin: 30, status: "atendido", price: 100, professionalId: "p1", professional: "Dr A", customerName: "X", service: "Consulta" },
    { id: "t2", startsAt: at(11, 0), durationMin: 60, status: "confirmado", price: 150, professionalId: "p1", professional: "Dr A", customerName: "Y", service: "Retorno" },
    { id: "t3", startsAt: at(9, 30), durationMin: 60, status: "confirmado", price: 0, professionalId: "p2", professional: "Dr B", customerName: "Z", service: "Sessão" },
    { id: "t4", startsAt: at(8, 0), durationMin: 30, status: "faltou", price: 0, professionalId: "p2", professional: "Dr B", customerName: "W", service: "" },
  ];
  const period = [
    { status: "atendido", price: 100, professional: "Dr A", professionalId: "p1", startsAt: at(9, 0) },
    { status: "atendido", price: 50, professional: "Dr A", professionalId: "p1", startsAt: at(9, 30) },
    { status: "atendido", price: 200, professional: "Dr B", professionalId: "p2", startsAt: at(10, 0) },
    { status: "faltou", price: 0, professional: "Dr B", professionalId: "p2", startsAt: at(8, 0) },
    { status: "cancelado", price: 0, professional: "Dr A", professionalId: "p1", startsAt: at(7, 0) },
    { status: "confirmado", price: 0, professional: "Dr A", professionalId: "p1", startsAt: at(11, 0) },
  ];

  prisma.appointment.findMany
    .mockResolvedValueOnce(todays) // 1ª chamada: consultas de hoje
    .mockResolvedValueOnce(period); // 2ª chamada: período
  prisma.appointment.aggregate.mockResolvedValue({ _sum: { price: 350 } });
  prisma.customer.count
    .mockResolvedValueOnce(5) // novos no mês
    .mockResolvedValueOnce(1); // novos hoje
});

afterEach(() => {
  vi.useRealTimers();
});

describe("isHealthNiche", () => {
  it("reconhece os nichos de saúde", () => {
    expect(isHealthNiche("nutricionista")).toBe(true);
    expect(isHealthNiche("psicologia")).toBe(true);
    expect(isHealthNiche("clinica")).toBe(true);
    expect(isHealthNiche("mercado_varejo")).toBe(false);
  });
});

describe("getClinicDashboard — retrato do dia", () => {
  it("conta os status do dia corretamente", async () => {
    const d = await getClinicDashboard(ORG);
    expect(d.today.total).toBe(4);
    expect(d.today.atendidos).toBe(1);
    expect(d.today.confirmados).toBe(2);
    expect(d.today.faltas).toBe(1);
    expect(d.today.agendados).toBe(0);
  });

  it("fatura apenas as consultas atendidas do dia", async () => {
    const d = await getClinicDashboard(ORG);
    expect(d.faturamentoDia).toBe(100); // só t1 (atendido, 100)
  });

  it("detecta em andamento e aguardando", async () => {
    const d = await getClinicDashboard(ORG);
    // t3: 09:30–10:30 contém 10:00 → em andamento; confirmada e já começou → aguardando
    expect(d.today.emAndamento).toBe(1);
    expect(d.today.aguardando).toBe(1);
  });

  it("lista só as próximas consultas futuras em aberto", async () => {
    const d = await getClinicDashboard(ORG);
    expect(d.upcoming).toHaveLength(1);
    expect(d.upcoming[0].id).toBe("t2");
  });
});

describe("getClinicDashboard — indicadores do período", () => {
  it("faturamento do mês vem do agregado", async () => {
    const d = await getClinicDashboard(ORG);
    expect(d.faturamentoMes).toBe(350);
  });

  it("taxa de faltas = faltas / (atendidas + faltas)", async () => {
    const d = await getClinicDashboard(ORG);
    // 3 atendidas + 1 falta → 1/4 = 25%
    expect(d.taxaFaltas).toBe(25);
    expect(d.cancelamentosPeriodo).toBe(1);
  });

  it("ocupação = minutos agendados / (profissionais × 8h)", async () => {
    const d = await getClinicDashboard(ORG);
    // 30+60+60+30 = 180 min; 2 profissionais × 480 = 960 → 18.8%
    expect(d.taxaOcupacao).toBe(18.8);
  });

  it("ranking ordena por atendimentos e soma faturamento", async () => {
    const d = await getClinicDashboard(ORG);
    expect(d.ranking).toHaveLength(2);
    expect(d.ranking[0].professional).toBe("Dr A");
    expect(d.ranking[0].atendidos).toBe(2);
    expect(d.ranking[0].faturamento).toBe(150); // 100 + 50
  });

  it("conta novos pacientes do mês e do dia", async () => {
    const d = await getClinicDashboard(ORG);
    expect(d.novosPacientesMes).toBe(5);
    expect(d.novosPacientesHoje).toBe(1);
  });

  it("gera alertas de aguardando e de taxa de faltas alta", async () => {
    const d = await getClinicDashboard(ORG);
    const msgs = d.alertas.map((a) => a.message).join(" | ");
    expect(msgs).toContain("aguardando");
    expect(d.alertas.some((a) => a.level === "danger")).toBe(true); // faltas 25% >= 20
  });
});
