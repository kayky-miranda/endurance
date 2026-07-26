import { describe, it, expect } from "vitest";
import {
  isValidCpf,
  formatCpf,
  onlyDigits,
  ageFromBirth,
} from "@/lib/endurance/patient";

describe("isValidCpf", () => {
  it("aceita CPFs válidos (com e sem máscara)", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true); // CPF válido conhecido
    expect(isValidCpf("52998224725")).toBe(true);
  });

  it("rejeita dígitos verificadores errados", () => {
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("12345678900")).toBe(false);
  });

  it("rejeita tamanho errado e sequências repetidas", () => {
    expect(isValidCpf("123")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("00000000000")).toBe(false);
  });
});

describe("formatCpf", () => {
  it("formata 11 dígitos e devolve o original caso contrário", () => {
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    expect(formatCpf("123")).toBe("123");
  });
});

describe("onlyDigits", () => {
  it("remove tudo que não é dígito", () => {
    expect(onlyDigits("529.982.247-25")).toBe("52998224725");
    expect(onlyDigits("(11) 99999-0000")).toBe("11999990000");
  });
});

describe("ageFromBirth", () => {
  const now = new Date(2026, 5, 15); // 15/06/2026

  it("calcula idade considerando o mês/dia", () => {
    expect(ageFromBirth(new Date(2000, 5, 15), now)).toBe(26); // faz aniversário hoje
    expect(ageFromBirth(new Date(2000, 5, 16), now)).toBe(25); // amanhã ainda não fez
    expect(ageFromBirth(new Date(1990, 0, 1), now)).toBe(36);
  });

  it("null para ausente ou data futura", () => {
    expect(ageFromBirth(null, now)).toBeNull();
    expect(ageFromBirth(new Date(2030, 0, 1), now)).toBeNull();
  });
});
