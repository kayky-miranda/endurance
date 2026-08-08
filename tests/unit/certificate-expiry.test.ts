import { describe, it, expect } from "vitest";
import {
  CERT_CRITICAL_DAYS,
  CERT_WARNING_DAYS,
  certDaysLeft,
  certStatus,
  certNeedsAttention,
  certMessage,
} from "@/lib/endurance/certificate-expiry";

const DAY = 86_400_000;
const agora = new Date("2026-08-10T12:00:00Z");
const emDias = (n: number) => new Date(agora.getTime() + n * DAY);

/**
 * O A1 dura 1 ano e, no dia seguinte ao vencimento, a SEFAZ recusa tudo: o
 * balcão para sem erro anterior. É a falha mais previsível de um ERP fiscal.
 */
describe("validade do certificado A1", () => {
  it("classifica os níveis de aviso", () => {
    expect(certStatus(emDias(120), agora)).toBe("ok");
    expect(certStatus(emDias(CERT_WARNING_DAYS), agora)).toBe("atencao");
    expect(certStatus(emDias(CERT_CRITICAL_DAYS), agora)).toBe("critico");
    expect(certStatus(emDias(0), agora)).toBe("critico");
    expect(certStatus(emDias(-1), agora)).toBe("vencido");
  });

  it("sem certificado é 'ausente', não 'vencido'", () => {
    // São situações diferentes: uma nunca começou, a outra parou de valer.
    expect(certStatus(null, agora)).toBe("ausente");
    expect(certDaysLeft(null, agora)).toBe(null);
  });

  it("os avisos começam cedo — renovar A1 não é imediato", () => {
    // O cliente precisa acionar contador ou certificadora; avisar na véspera
    // não ajuda ninguém.
    expect(CERT_WARNING_DAYS).toBeGreaterThanOrEqual(15);
    expect(CERT_CRITICAL_DAYS).toBeLessThan(CERT_WARNING_DAYS);
  });

  it("exige ação em tudo que não está confortável", () => {
    expect(certNeedsAttention(certStatus(emDias(-5), agora))).toBe(true);
    expect(certNeedsAttention(certStatus(emDias(3), agora))).toBe(true);
    expect(certNeedsAttention(certStatus(emDias(20), agora))).toBe(true);
    expect(certNeedsAttention(certStatus(emDias(200), agora))).toBe(false);
  });

  it("a mensagem diz a CONSEQUÊNCIA, não só o prazo", () => {
    // "vence em 5 dias" não comunica urgência para quem não sabe que a
    // emissão para junto.
    expect(certMessage(emDias(3), agora)).toMatch(/emissão para|renovação/i);
    expect(certMessage(emDias(-2), agora)).toMatch(/parada/i);
    expect(certMessage(null, agora)).toMatch(/não é possível emitir/i);
  });

  it("caso do dia do vencimento é tratado à parte", () => {
    expect(certMessage(emDias(0), agora)).toMatch(/HOJE/);
  });

  it("dias restantes contam para baixo", () => {
    expect(certDaysLeft(emDias(10), agora)).toBe(10);
    expect(certDaysLeft(emDias(-3), agora)).toBe(-3);
  });
});
