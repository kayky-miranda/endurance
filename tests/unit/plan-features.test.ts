import { describe, it, expect } from "vitest";
import {
  planAllows,
  planCapabilities,
  planRequiredFor,
  planAiCredits,
  planById,
  PLAN_CATALOG,
  PLAN_FEATURES,
  PLAN_FEATURE_CATALOG,
  PLAN_ORDER,
  TRIAL_PLAN,
} from "@/lib/endurance/billing";

/**
 * Regra que decide o que cada cliente paga. Um erro aqui cobra a mais de quem
 * não deve ou entrega de graça o que separa os planos.
 */
describe("planAllows", () => {
  it("libera de forma CUMULATIVA — o plano de cima herda o de baixo", () => {
    // multi.location entra no Business; o Enterprise também precisa ter.
    expect(planAllows("business", "multi.location")).toBe(true);
    expect(planAllows("enterprise", "multi.location")).toBe(true);
    expect(planAllows("professional", "multi.location")).toBe(false);
  });

  it("capacidade do topo não vaza para os planos abaixo", () => {
    expect(planAllows("enterprise", "multi.company")).toBe(true);
    expect(planAllows("business", "multi.company")).toBe(false);
    expect(planAllows("professional", "white.label")).toBe(false);
    expect(planAllows("starter", "priority.processing")).toBe(false);
  });

  it("DIREITO ADQUIRIDO: cliente antigo mantém tudo", () => {
    // Nenhuma capacidade pode ser removida de quem já usava o sistema.
    for (const f of PLAN_FEATURES) {
      expect(planAllows("starter", f, { legacyFullAccess: true })).toBe(true);
    }
  });

  it("plano desconhecido cai no mais restrito, não no mais permissivo", () => {
    // Dado corrompido nunca deve liberar recurso pago.
    expect(planAllows("plano_inexistente", "api.access")).toBe(false);
    expect(planAllows("", "multi.company")).toBe(false);
  });
});

describe("planRequiredFor", () => {
  it("aponta o MENOR plano que resolve — é o que a tela de bloqueio oferece", () => {
    expect(planRequiredFor("api.access")).toBe("business");
    expect(planRequiredFor("audit.log")).toBe("business");
    expect(planRequiredFor("multi.company")).toBe("enterprise");
    expect(planRequiredFor("white.label")).toBe("enterprise");
  });

  it("toda capacidade pertence a algum plano (nenhuma órfã)", () => {
    for (const f of PLAN_FEATURES) {
      expect(planRequiredFor(f)).not.toBeNull();
    }
  });
});

describe("planCapabilities", () => {
  it("acumula ao subir de plano", () => {
    const pro = planCapabilities("professional");
    const biz = planCapabilities("business");
    const ent = planCapabilities("enterprise");
    expect(biz.length).toBeGreaterThan(pro.length);
    expect(ent.length).toBeGreaterThan(biz.length);
    // Tudo do Business continua no Enterprise.
    for (const f of biz) expect(ent).toContain(f);
  });

  it("o topo entrega todas as capacidades do catálogo", () => {
    expect(new Set(planCapabilities("enterprise"))).toEqual(new Set(PLAN_FEATURES));
  });
});

describe("integridade do catálogo", () => {
  it("nenhuma capacidade é declarada em dois planos", () => {
    const seen = new Set<string>();
    for (const p of PLAN_CATALOG) {
      for (const f of p.adds) {
        expect(seen.has(f), `"${f}" duplicada em ${p.id}`).toBe(false);
        seen.add(f);
      }
    }
  });

  it("toda capacidade tem rótulo e frase de venda", () => {
    for (const f of PLAN_FEATURES) {
      const def = PLAN_FEATURE_CATALOG[f];
      expect(def).toBeDefined();
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.pitch.length).toBeGreaterThan(0);
    }
  });

  it("preço e assentos crescem junto com o plano", () => {
    const pagos = PLAN_ORDER.map((id) => planById(id)!).filter(
      (p) => (p.priceMonthly ?? 0) > 0,
    );
    for (let i = 1; i < pagos.length; i++) {
      expect(pagos[i].priceMonthly!).toBeGreaterThan(pagos[i - 1].priceMonthly!);
      expect(pagos[i].seats).toBeGreaterThan(pagos[i - 1].seats);
    }
  });

  it("usuário extra fica mais barato nos planos maiores", () => {
    // Volume tem que compensar: é o que torna o upgrade racional para o cliente.
    const pro = planById("professional")!.extraSeatPrice!;
    const biz = planById("business")!.extraSeatPrice!;
    const ent = planById("enterprise")!.extraSeatPrice!;
    expect(biz).toBeLessThan(pro);
    expect(ent).toBeLessThan(biz);
  });

  it("créditos de IA crescem entre os planos pagos e o topo não tem teto", () => {
    expect(planAiCredits("business")).toBeGreaterThan(planAiCredits("professional"));
    expect(planAiCredits("enterprise")).toBe(-1);
  });

  it("o teste espelha exatamente o plano que ele entrega", () => {
    // O card do teste é derivado, não digitado: quando os dois divergiram, a
    // página anunciava 2 usuários e 60 créditos enquanto a assinatura de teste
    // nascia com 3 e 150. Este teste é o que impede a divergência de voltar.
    const teste = planById("starter")!;
    const origem = planById(TRIAL_PLAN)!;
    expect(teste.aiCredits).toBe(origem.aiCredits);
    expect(teste.seats).toBe(origem.seats);
    expect(teste.features.join(" ")).toContain(String(origem.aiCredits));
  });

  it("todo plano dá algum crédito de IA — ninguém fica sem experimentar", () => {
    // Se o diferencial do produto é a IA, nenhum plano pode ficar sem prová-la.
    for (const p of PLAN_CATALOG) {
      expect(p.aiCredits === -1 || p.aiCredits > 0).toBe(true);
    }
  });
});
