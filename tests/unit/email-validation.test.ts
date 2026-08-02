import { describe, it, expect } from "vitest";
import { isValidEmail, EMAIL_RE } from "@/lib/endurance/validation";

/**
 * Regra de e-mail: definição única consumida pelos schemas Zod e pelos serviços
 * de domínio (pacientes, fornecedores). O teste protege contra alguém voltar a
 * copiar o regex e as duas pontas divergirem.
 */
describe("isValidEmail", () => {
  it("aceita endereços comuns", () => {
    expect(isValidEmail("maria@exemplo.com")).toBe(true);
    expect(isValidEmail("ana.paula+tag@clinica.com.br")).toBe(true);
    expect(isValidEmail("  joao@ex.org  ")).toBe(true); // tolera espaços nas pontas
  });

  it("recusa o erro de digitação óbvio", () => {
    expect(isValidEmail("nao-eh-email")).toBe(false);
    expect(isValidEmail("sem@dominio")).toBe(false);
    expect(isValidEmail("@exemplo.com")).toBe(false);
    expect(isValidEmail("com espaco@ex.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });

  it("expõe o regex para os schemas Zod reaproveitarem", () => {
    expect(EMAIL_RE.test("maria@exemplo.com")).toBe(true);
    expect(EMAIL_RE.test("nao-eh-email")).toBe(false);
  });
});
