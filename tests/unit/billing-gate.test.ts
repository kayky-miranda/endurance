import { describe, it, expect } from "vitest";
import {
  ALLOWED_WHEN_DELINQUENT,
  allowedWhenDelinquent,
} from "@/lib/endurance/billing-gate";
import { PERMISSIONS } from "@/lib/endurance/permissions";

/**
 * Esta regra é o que faz o teste de 14 dias realmente terminar. Antes o gate de
 * assinatura existia mas era chamado só nas ações de equipe: o cliente com o
 * teste vencido seguia vendendo, emitindo nota e prescrevendo para sempre,
 * impedido apenas de convidar um colega.
 */
describe("bloqueio por assinatura irregular", () => {
  it("bloqueia a operação do dia a dia", () => {
    for (const p of ["pdv.sell", "prontuario.manage", "fiscal.manage", "stock.manage"])
      expect(allowedWhenDelinquent(p), p).toBe(false);
  });

  it("NUNCA bloqueia pagar — senão a cobrança se voltaria contra si mesma", () => {
    expect(allowedWhenDelinquent("subscription.manage")).toBe(true);
  });

  it("não prende os dados do cliente: exportação continua liberada", () => {
    expect(allowedWhenDelinquent("reports.export")).toBe(true);
  });

  it("toda exceção é uma permissão que existe de verdade", () => {
    // Um id escrito errado viraria uma exceção que nunca casa — e o recurso
    // ficaria bloqueado em silêncio, que é o defeito mais caro de diagnosticar.
    const known = new Set<string>(PERMISSIONS.map((p) => p.id));
    for (const id of ALLOWED_WHEN_DELINQUENT) expect(known.has(id), id).toBe(true);
  });

  it("a lista de exceções é curta — cada item precisa se justificar", () => {
    expect(ALLOWED_WHEN_DELINQUENT.size).toBeLessThanOrEqual(5);
  });
});
