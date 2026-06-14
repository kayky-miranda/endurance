import { describe, it, expect } from "vitest";
import { crc16ccitt, buildPixBrCode, makeTxid } from "@/lib/endurance/pix-emv";

describe("crc16ccitt", () => {
  it("usa o vetor de teste padrão CRC-16/CCITT-FALSE", () => {
    // Valor de verificação canônico: CRC("123456789") = 0x29B1.
    expect(crc16ccitt("123456789")).toBe("29B1");
  });

  it("devolve sempre 4 hex maiúsculos", () => {
    expect(crc16ccitt("a")).toMatch(/^[0-9A-F]{4}$/);
  });
});

describe("buildPixBrCode", () => {
  const brCode = buildPixBrCode({
    pixKey: "loja@example.com",
    nome: "Mercadinho do Zé",
    cidade: "São Paulo",
    valor: 10,
    txid: "VENDA123",
  });

  it("começa com o Payload Format Indicator e o GUI do PIX", () => {
    expect(brCode.startsWith("000201")).toBe(true);
    expect(brCode).toContain("br.gov.bcb.pix");
    expect(brCode).toContain("loja@example.com");
  });

  it("inclui moeda BRL e o valor formatado", () => {
    expect(brCode).toContain("5303986"); // 53 (moeda) len 03 valor 986
    expect(brCode).toContain("540510.00"); // 54 (valor) len 05 valor "10.00"
  });

  it("normaliza o nome para ASCII (sem acento) e respeita o txid", () => {
    expect(brCode).toContain("Mercadinho do Ze"); // "Zé" → "Ze"
    expect(brCode).toContain("VENDA123");
  });

  it("termina com um CRC consistente com o próprio payload", () => {
    const semCrc = brCode.slice(0, -4);
    const crc = brCode.slice(-4);
    expect(crc16ccitt(semCrc)).toBe(crc);
  });

  it("omite o campo de valor (54) quando não informado", () => {
    const sem = buildPixBrCode({
      pixKey: "x@y.com",
      nome: "X",
      cidade: "Y",
      txid: "T",
    });
    // Sem valor, a moeda (53) é seguida direto pelo país (58) — não há campo 54.
    expect(sem).toContain("53039865802BR");
  });
});

describe("makeTxid", () => {
  it("remove não-alfanuméricos e limita a 25", () => {
    const t = makeTxid("a1b2-c3.d4!" + "z".repeat(40));
    expect(t).toMatch(/^[A-Za-z0-9]{25}$/);
  });
});
