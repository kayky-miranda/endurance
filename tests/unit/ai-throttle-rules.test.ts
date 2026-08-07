import { describe, it, expect } from "vitest";
import {
  PRIORITY_MULTIPLIER,
  effectiveAiLimit,
} from "@/lib/endurance/ai-throttle-rules";

/**
 * O processamento prioritário virou limite de rajada maior porque não existe
 * fila no sistema — a promessa antiga ("sua fila de IA na frente") descrevia
 * uma infraestrutura inexistente.
 */
describe("limite de rajada da IA", () => {
  it("sem prioridade mantém o limite base", () => {
    expect(effectiveAiLimit(10, false)).toBe(10);
    expect(effectiveAiLimit(12, false)).toBe(12);
  });

  it("com prioridade multiplica", () => {
    expect(effectiveAiLimit(10, true)).toBe(10 * PRIORITY_MULTIPLIER);
    expect(effectiveAiLimit(12, true)).toBe(12 * PRIORITY_MULTIPLIER);
  });

  it("o limite continua existindo mesmo no plano mais caro", () => {
    // O limite protege contra automação acidental e rajada de script; esse
    // propósito precisa sobreviver ao Enterprise. Prioridade não é "ilimitado".
    expect(PRIORITY_MULTIPLIER).toBeGreaterThan(1);
    expect(PRIORITY_MULTIPLIER).toBeLessThanOrEqual(10);
    expect(Number.isFinite(effectiveAiLimit(10, true))).toBe(true);
  });

  it("a diferença é perceptível — senão a capacidade não se justifica", () => {
    expect(effectiveAiLimit(10, true)).toBeGreaterThanOrEqual(
      effectiveAiLimit(10, false) * 2,
    );
  });
});
