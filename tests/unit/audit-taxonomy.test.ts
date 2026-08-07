import { describe, it, expect } from "vitest";
import {
  AUDIT_DOMAINS,
  actionPrefix,
  domainOf,
  isSensitive,
  actionLabel,
} from "@/lib/endurance/audit-taxonomy";

/**
 * A taxonomia decide em que área da trilha cada ação aparece. Um erro aqui
 * esconde a ação no filtro errado — e uma trilha em que não se acha nada não
 * responde a pergunta que justifica a auditoria existir.
 */
describe("domínio de uma ação", () => {
  it("agrupa pelo prefixo, não pela ação inteira", () => {
    expect(domainOf("nfce.emit").id).toBe("fiscal");
    expect(domainOf("nfe.cancel").id).toBe("fiscal");
    expect(domainOf("finance.entry_create").id).toBe("financeiro");
    expect(domainOf("cash.close").id).toBe("financeiro");
  });

  it("ação desconhecida NUNCA some — cai em Outros", () => {
    // Um `logActivity` novo com prefixo inédito precisa continuar visível: a
    // trilha some no dia em que ela decide o que não mostrar.
    const d = domainOf("modulo_que_nao_existe.fez_algo");
    expect(d.id).toBe("outros");
    expect(d.label).toBe("Outros");
  });

  it("ação sem ponto não quebra", () => {
    expect(actionPrefix("login")).toBe("login");
    expect(domainOf("login").id).toBe("outros");
  });

  it("marca como sensível o que toca dado pessoal ou clínico", () => {
    expect(isSensitive("prontuario.note_create")).toBe(true);
    expect(isSensitive("patient.delete")).toBe(true);
    expect(isSensitive("appointment.create")).toBe(true);
    expect(isSensitive("user.block")).toBe(true);
    expect(isSensitive("product.create")).toBe(false);
    expect(isSensitive("nfce.emit")).toBe(false);
  });
});

describe("integridade da taxonomia", () => {
  it("nenhum prefixo pertence a dois domínios", () => {
    // Prefixo duplicado faria a mesma ação aparecer em duas áreas conforme a
    // ordem do array — um bug que só apareceria em produção.
    const seen = new Map<string, string>();
    for (const d of AUDIT_DOMAINS) {
      for (const p of d.prefixes) {
        expect(seen.has(p), `${p} duplicado em ${seen.get(p)} e ${d.id}`).toBe(false);
        seen.set(p, d.id);
      }
    }
  });

  it("ids de domínio são únicos", () => {
    const ids = AUDIT_DOMAINS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("cobre os prefixos realmente usados pelo sistema", () => {
    // Amostra retirada das chamadas de logActivity existentes. Se alguma cair
    // em "Outros", o filtro por área ficou incompleto.
    const usados = [
      "user", "invite", "subscription", "theme", "location", "apikey",
      "documents", "template", "settings", "receipt", "professional",
      "password", "product", "stock", "stock_count", "supplier", "purchase",
      "purchaseorder", "requisition", "quotation", "barcode", "finance",
      "cash", "nfce", "nfe", "patient", "prontuario", "clinical_note",
      "anamnese", "prescription", "certificate", "exam", "metric",
      "meal_plan", "assessment", "workout", "student", "appointment",
      "agenda", "waitlist",
    ];
    const orfaos = usados.filter((p) => domainOf(`${p}.x`).id === "outros");
    expect(orfaos).toEqual([]);
  });
});

describe("rótulo de fallback", () => {
  it("traduz o verbo quando o detalhe está vazio", () => {
    expect(actionLabel("product.create")).toContain("criou");
    expect(actionLabel("nfce.emit")).toContain("emitiu");
  });

  it("verbo desconhecido devolve a ação crua em vez de inventar", () => {
    expect(actionLabel("foo.bar_baz")).toBe("foo.bar_baz");
  });
});
