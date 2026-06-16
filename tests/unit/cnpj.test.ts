import { describe, it, expect } from "vitest";
import { onlyDigits, formatCnpj, isValidCnpj } from "@/lib/endurance/cnpj";

describe("cnpj", () => {
  it("onlyDigits remove máscara", () => {
    expect(onlyDigits("11.222.333/0001-81")).toBe("11222333000181");
    expect(onlyDigits("abc12-34")).toBe("1234");
  });

  it("formatCnpj aplica a máscara em 14 dígitos", () => {
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("formatCnpj devolve parcial sem máscara", () => {
    expect(formatCnpj("112223")).toBe("112223");
  });

  it("isValidCnpj aceita CNPJs válidos (com e sem máscara)", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11222333000181")).toBe(true);
    expect(isValidCnpj("04.252.011/0001-10")).toBe(true);
  });

  it("isValidCnpj rejeita dígito verificador errado", () => {
    expect(isValidCnpj("11222333000182")).toBe(false);
    expect(isValidCnpj("11.222.333/0001-80")).toBe(false);
  });

  it("isValidCnpj rejeita tamanho errado e sequências repetidas", () => {
    expect(isValidCnpj("123")).toBe(false);
    expect(isValidCnpj("00000000000000")).toBe(false);
    expect(isValidCnpj("11111111111111")).toBe(false);
  });
});
