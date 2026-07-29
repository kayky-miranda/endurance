import { describe, it, expect, beforeEach } from "vitest";
import { generateClinicInsights } from "@/lib/endurance/clinic-insights";
import type { ProductivityReport } from "@/lib/endurance/productivity";

// Força o caminho HEURÍSTICO (sem IA): remove qualquer chave do ambiente.
beforeEach(() => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
});

const report = (rows: ProductivityReport["rows"]): ProductivityReport => ({
  rows,
  totalAtendidos: rows.reduce((s, r) => s + r.atendidos, 0),
  totalRevenue: rows.reduce((s, r) => s + r.revenue, 0),
});

const row = (o: Partial<ProductivityReport["rows"][number]>) => ({
  professional: "Prof",
  atendidos: 0,
  faltas: 0,
  cancelados: 0,
  agendados: 0,
  attendanceRate: 0,
  revenue: 0,
  avgTicket: 0,
  ...o,
});

describe("generateClinicInsights (heurística)", () => {
  it("relatório vazio devolve info de 'sem atendimentos'", async () => {
    const r = await generateClinicInsights({
      periodLabel: "30 dias",
      report: report([]),
      totalCommission: 0,
    });
    expect(r.source).toBe("heuristic");
    expect(r.insights).toHaveLength(1);
    expect(r.insights[0].title).toMatch(/sem atendimentos/i);
  });

  it("comparecimento baixo vira ALERTA", async () => {
    const r = await generateClinicInsights({
      periodLabel: "30 dias",
      report: report([
        row({ professional: "Ana", atendidos: 6, faltas: 4, attendanceRate: 0.6, revenue: 1200, avgTicket: 200 }),
      ]),
      totalCommission: 120,
    });
    expect(r.source).toBe("heuristic");
    expect(r.insights.some((i) => i.kind === "alerta")).toBe(true);
    // Não fabrica mais que 4 insights.
    expect(r.insights.length).toBeLessThanOrEqual(4);
  });

  it("comparecimento alto não gera alerta de comparecimento", async () => {
    const r = await generateClinicInsights({
      periodLabel: "30 dias",
      report: report([
        row({ professional: "Bia", atendidos: 18, faltas: 1, attendanceRate: 0.95, revenue: 3600, avgTicket: 200 }),
      ]),
      totalCommission: 360,
    });
    const first = r.insights[0];
    expect(first.kind).toBe("info");
    expect(first.title).toMatch(/comparecimento/i);
  });
});
