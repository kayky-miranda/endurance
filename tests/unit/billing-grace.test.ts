import { describe, it, expect } from "vitest";
import {
  GRACE_DAYS,
  graceEndsAt,
  inGracePeriod,
  graceDaysLeft,
} from "@/lib/endurance/billing-grace";

const DAY = 86_400_000;
const agora = new Date("2026-08-10T12:00:00Z");
const diasAtras = (n: number) => new Date(agora.getTime() - n * DAY);

/**
 * O bloqueio por assinatura irregular é real: toda mutação para. Sem carência,
 * um cartão recusado travaria a operação do cliente no mesmo dia.
 */
describe("carência após falha de pagamento", () => {
  it("logo após a falha o cliente continua operando", () => {
    expect(inGracePeriod(diasAtras(0), agora)).toBe(true);
    expect(inGracePeriod(diasAtras(1), agora)).toBe(true);
  });

  it("no último dia ainda opera; passado o prazo, não", () => {
    expect(inGracePeriod(diasAtras(GRACE_DAYS - 1), agora)).toBe(true);
    expect(inGracePeriod(diasAtras(GRACE_DAYS), agora)).toBe(false);
    expect(inGracePeriod(diasAtras(GRACE_DAYS + 30), agora)).toBe(false);
  });

  it("SEM carência quando nunca houve pagamento (teste expirado)", () => {
    // A carência do teste já foram os 14 dias; dar mais uma semana seria
    // estender o teste, não perdoar uma falha.
    expect(inGracePeriod(null, agora)).toBe(false);
    expect(inGracePeriod(undefined, agora)).toBe(false);
    expect(graceDaysLeft(null, agora)).toBe(0);
  });

  it("arredonda os dias restantes PARA CIMA", () => {
    // Faltando 4h o cliente precisa ler "1 dia", não "0 dias".
    const quatroHorasPraAcabar = new Date(
      agora.getTime() - (GRACE_DAYS * DAY - 4 * 3_600_000),
    );
    expect(graceDaysLeft(quatroHorasPraAcabar, agora)).toBe(1);
    expect(graceDaysLeft(diasAtras(0), agora)).toBe(GRACE_DAYS);
  });

  it("nunca devolve dias negativos", () => {
    expect(graceDaysLeft(diasAtras(GRACE_DAYS + 5), agora)).toBe(0);
  });

  it("o fim da carência é exatamente o início + o prazo", () => {
    const inicio = diasAtras(2);
    expect(graceEndsAt(inicio).getTime()).toBe(inicio.getTime() + GRACE_DAYS * DAY);
  });

  it("o prazo cobre um fim de semana e a ida ao banco", () => {
    expect(GRACE_DAYS).toBeGreaterThanOrEqual(5);
    expect(GRACE_DAYS).toBeLessThanOrEqual(15);
  });
});
