import { describe, it, expect } from "vitest";
import {
  providerErrorCode,
  isQuotaError,
} from "@/lib/endurance/gemini";

/**
 * O SDK do provedor ENVELOPA o erro: um 429 de cota chega com `status: 400` e o
 * código verdadeiro só aparece dentro da mensagem. Confiar no `status` fazia o
 * laço de modelos desistir na primeira tentativa e reportar "falha genérica"
 * quando o problema real era cota — foi assim que apareceu em produção.
 */
describe("providerErrorCode", () => {
  it("extrai o 429 real de dentro de um erro embrulhado como 400", () => {
    const wrapped = {
      status: 400,
      message:
        '{"error":{"message":"{\\n  \\"error\\": {\\n    \\"code\\": 429,\\n    \\"message\\": \\"You exceeded your current quota\\"\\n  }\\n}"}}',
    };
    expect(providerErrorCode(wrapped)).toBe(429);
    expect(isQuotaError(wrapped)).toBe(true);
  });

  it("reconhece cota pelo texto quando não há código numérico", () => {
    expect(providerErrorCode({ status: 400, message: "RESOURCE_EXHAUSTED" })).toBe(429);
    expect(isQuotaError({ message: "quota exceeded for this project" })).toBe(true);
  });

  it("usa o status quando ele é o próprio erro", () => {
    expect(providerErrorCode({ status: 503, message: "service unavailable" })).toBe(503);
    expect(providerErrorCode({ status: 404, message: "model not found" })).toBe(404);
  });

  it("erro desconhecido não vira cota por engano", () => {
    expect(providerErrorCode({ message: "socket hang up" })).toBe(0);
    expect(isQuotaError({ status: 500, message: "internal" })).toBe(false);
    expect(isQuotaError(null)).toBe(false);
  });
});
