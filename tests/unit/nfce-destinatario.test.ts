import { describe, it, expect } from "vitest";
import {
  destinatarioKind,
  checkNfceDestinatario,
} from "@/lib/endurance/nfce-destinatario";

/**
 * A NFC-e é documento de venda ao consumidor. Desde jan/2026 a SEFAZ recusa
 * destinatário pessoa jurídica — venda para CNPJ tem que sair como NF-e.
 * Sem esta regra a nota era montada e transmitida assim mesmo, e o CNPJ ainda
 * ia no campo `cpf_destinatario` do provedor.
 */
describe("destinatário da NFC-e", () => {
  it("classifica pelo tamanho, aceitando pontuação", () => {
    expect(destinatarioKind("529.982.247-25")).toBe("cpf");
    expect(destinatarioKind("11.222.333/0001-81")).toBe("cnpj");
    expect(destinatarioKind("")).toBe("ausente");
    expect(destinatarioKind(null)).toBe("ausente");
    expect(destinatarioKind(undefined)).toBe("ausente");
    expect(destinatarioKind("123")).toBe("invalido");
  });

  it("CONSUMIDOR SEM DOCUMENTO é o caso normal e passa", () => {
    // NFC-e não exige identificação do comprador — bloquear aqui pararia o
    // balcão inteiro.
    expect(checkNfceDestinatario(null).ok).toBe(true);
    expect(checkNfceDestinatario("").ok).toBe(true);
  });

  it("CPF passa", () => {
    expect(checkNfceDestinatario("529.982.247-25").ok).toBe(true);
  });

  it("CNPJ é barrado e a mensagem aponta a NF-e", () => {
    const r = checkNfceDestinatario("11.222.333/0001-81");
    expect(r.ok).toBe(false);
    expect(r.kind).toBe("cnpj");
    // Não basta recusar: o operador precisa saber para onde ir.
    expect(r.error).toMatch(/NF-e/);
    expect(r.error).toMatch(/modelo 55/);
  });

  it("documento com tamanho errado é barrado antes de virar rejeição da SEFAZ", () => {
    const r = checkNfceDestinatario("12345");
    expect(r.ok).toBe(false);
    expect(r.kind).toBe("invalido");
    expect(r.error).toMatch(/11 dígitos|14/);
  });

  it("o veredito sempre informa o tipo, mesmo quando aprova", () => {
    // A tela usa o tipo para decidir o aviso, não só o ok/não-ok.
    expect(checkNfceDestinatario("529.982.247-25").kind).toBe("cpf");
    expect(checkNfceDestinatario(null).kind).toBe("ausente");
  });
});
