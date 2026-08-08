import { describe, it, expect } from "vitest";
import {
  documentKind,
  isValidBillingDocument,
  billingDocumentError,
  formatBillingDocument,
  onlyDigits,
} from "@/lib/endurance/billing-document";

/**
 * O checkout antigo só conferia o COMPRIMENTO do documento (11 ou 14 dígitos).
 * Um CPF inventado passava aqui e era recusado lá no gateway, onde a mensagem
 * de erro não diz ao cliente o que ele digitou errado.
 */
describe("documento de cobrança", () => {
  it("reconhece CPF e CNPJ pelo tamanho", () => {
    expect(documentKind("529.982.247-25")).toBe("cpf");
    expect(documentKind("11.222.333/0001-81")).toBe("cnpj");
    expect(documentKind("123")).toBe(null);
    expect(documentKind("")).toBe(null);
  });

  it("valida DÍGITOS VERIFICADORES, não só o tamanho", () => {
    expect(isValidBillingDocument("529.982.247-25")).toBe(true);
    expect(isValidBillingDocument("11.222.333/0001-81")).toBe(true);
    // Tamanho certo, documento falso — o caso que passava antes.
    expect(isValidBillingDocument("00000000000")).toBe(false);
    expect(isValidBillingDocument("11111111111111")).toBe(false);
    expect(isValidBillingDocument("52998224726")).toBe(false);
  });

  it("aceita com ou sem pontuação — o cliente digita como quiser", () => {
    expect(isValidBillingDocument("52998224725")).toBe(true);
    expect(isValidBillingDocument("529.982.247-25")).toBe(true);
    expect(isValidBillingDocument(" 529 982 247 25 ")).toBe(true);
  });

  it("a mensagem de erro diz o que fazer, não só que falhou", () => {
    expect(billingDocumentError("")).toMatch(/informe/i);
    expect(billingDocumentError("123")).toMatch(/11 dígitos|14/);
    expect(billingDocumentError("00000000000")).toBe("CPF inválido.");
    expect(billingDocumentError("11111111111111")).toBe("CNPJ inválido.");
    expect(billingDocumentError("529.982.247-25")).toBe(null);
  });

  it("formata para leitura", () => {
    expect(formatBillingDocument("52998224725")).toBe("529.982.247-25");
    expect(formatBillingDocument("11222333000181")).toBe("11.222.333/0001-81");
    // Incompleto sai como veio — formatar no meio da digitação faz o cursor pular.
    expect(formatBillingDocument("5299")).toBe("5299");
  });

  it("onlyDigits é o que vai para o banco e para o gateway", () => {
    expect(onlyDigits("529.982.247-25")).toBe("52998224725");
    expect(onlyDigits("")).toBe("");
  });
});
