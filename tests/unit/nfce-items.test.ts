import { describe, it, expect } from "vitest";
import { resolveNfceItems } from "@/lib/endurance/fiscal-service";

const line = (over: Partial<Parameters<typeof resolveNfceItems>[0][number]> = {}) => ({
  productId: "p1",
  name: "Arroz 5kg",
  quantity: 2,
  unitPrice: 25.9,
  ...over,
});

describe("resolveNfceItems", () => {
  it("usa o NCM e a unidade do PRODUTO quando disponíveis", () => {
    const r = resolveNfceItems(
      [line()],
      [{ id: "p1", ncm: "1006.30.21", unit: "kg" }],
      "62011900", // default da empresa — não deve ser usado aqui
    );
    expect(r.semNcm).toEqual([]);
    expect(r.itens[0].ncm).toBe("10063021"); // só dígitos, 8 posições
    expect(r.itens[0].unidade).toBe("KG"); // unidade real do produto, maiúscula
    expect(r.itens[0].valorUnitario).toBe(25.9);
    expect(r.itens[0].cfop).toBe("5102");
  });

  it("cai no NCM padrão da empresa quando o produto não tem NCM", () => {
    const r = resolveNfceItems(
      [line({ name: "Item sem NCM" })],
      [{ id: "p1", ncm: "", unit: "un" }],
      "62011900",
    );
    expect(r.semNcm).toEqual([]);
    expect(r.itens[0].ncm).toBe("62011900");
    expect(r.itens[0].unidade).toBe("UN");
  });

  it("NCM do produto com dígitos insuficientes cai no default", () => {
    const r = resolveNfceItems(
      [line()],
      [{ id: "p1", ncm: "123", unit: "un" }],
      "62011900",
    );
    expect(r.itens[0].ncm).toBe("62011900");
  });

  it("acusa em semNcm o item sem NCM próprio E sem default válido", () => {
    const r = resolveNfceItems(
      [line({ name: "Produto X" }), line({ productId: "p2", name: "Produto Y" })],
      [
        { id: "p1", ncm: "", unit: "un" },
        { id: "p2", ncm: "10063021", unit: "un" },
      ],
      "", // empresa sem default
    );
    // p1 fica sem NCM; p2 tem o próprio → só p1 é reportado.
    expect(r.semNcm).toEqual(["Produto X"]);
    expect(r.itens[1].ncm).toBe("10063021");
  });

  it("item sem productId usa o default e unidade UN", () => {
    const r = resolveNfceItems(
      [line({ productId: null, name: "Avulso" })],
      [],
      "62011900",
    );
    expect(r.semNcm).toEqual([]);
    expect(r.itens[0].ncm).toBe("62011900");
    expect(r.itens[0].unidade).toBe("UN");
    expect(r.itens[0].codigo).toBe("");
  });
});
