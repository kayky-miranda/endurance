import { describe, it, expect } from "vitest";
import {
  CANCEL_WINDOW_MINUTES,
  cancelWindowMinutes,
  cancelWindowEndsAt,
  withinCancelWindow,
  cancelMinutesLeft,
  cancelWindowLabel,
} from "@/lib/endurance/fiscal-cancel-window";

const agora = new Date("2026-08-10T12:00:00Z");
const minAtras = (n: number) => new Date(agora.getTime() - n * 60_000);

/**
 * O prazo de cancelamento não era conhecido pelo sistema: o operador descobria
 * pela recusa da SEFAZ, com o cliente no balcão e o produto de volta na mão.
 */
describe("prazo de cancelamento", () => {
  it("NFC-e tem prazo curto; NF-e tem 24h", () => {
    expect(cancelWindowMinutes("65")).toBe(30);
    expect(cancelWindowMinutes("55")).toBe(24 * 60);
    expect(CANCEL_WINDOW_MINUTES["65"]).toBeLessThan(CANCEL_WINDOW_MINUTES["55"]);
  });

  it("modelo desconhecido cai no prazo mais RESTRITIVO", () => {
    // Prometer prazo maior do que existe é pior do que prometer menos.
    expect(cancelWindowMinutes("99")).toBe(30);
  });

  it("dentro e fora da janela da NFC-e", () => {
    expect(withinCancelWindow("65", minAtras(5), agora)).toBe(true);
    expect(withinCancelWindow("65", minAtras(29), agora)).toBe(true);
    expect(withinCancelWindow("65", minAtras(30), agora)).toBe(false);
    expect(withinCancelWindow("65", minAtras(120), agora)).toBe(false);
  });

  it("NF-e ainda cancela horas depois", () => {
    expect(withinCancelWindow("55", minAtras(300), agora)).toBe(true);
    expect(withinCancelWindow("55", minAtras(25 * 60), agora)).toBe(false);
  });

  it("sem data de autorização NÃO inventa impedimento", () => {
    // Dado ausente não pode virar bloqueio: o documento pode ser antigo do
    // tempo em que a data não era gravada.
    expect(withinCancelWindow("65", null, agora)).toBe(true);
    expect(withinCancelWindow("65", undefined, agora)).toBe(true);
  });

  it("minutos restantes nunca ficam negativos", () => {
    expect(cancelMinutesLeft("65", minAtras(10), agora)).toBe(20);
    expect(cancelMinutesLeft("65", minAtras(45), agora)).toBe(0);
  });

  it("o rótulo diz o que fazer quando o prazo acabou", () => {
    expect(cancelWindowLabel("65", minAtras(10), agora)).toMatch(/20 min/);
    const vencido = cancelWindowLabel("65", minAtras(60), agora);
    expect(vencido).toMatch(/encerrado/i);
    // Não basta dizer que não dá — precisa dizer qual é o caminho.
    expect(vencido).toMatch(/devolução/i);
  });

  it("prazos longos aparecem em horas, não em minutos", () => {
    expect(cancelWindowLabel("55", minAtras(60), agora)).toMatch(/\d+ h/);
  });

  it("o fim da janela é a autorização + o prazo", () => {
    const aut = minAtras(10);
    expect(cancelWindowEndsAt("65", aut).getTime()).toBe(
      aut.getTime() + 30 * 60_000,
    );
  });
});
