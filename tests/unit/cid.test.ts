import { describe, it, expect } from "vitest";
import {
  searchCid,
  findCid,
  suggestCidFromText,
  CID10_CATALOG,
} from "@/lib/endurance/cid";

describe("searchCid", () => {
  it("acha por código (prefixo)", () => {
    const r = searchCid("J11");
    expect(r[0].code).toBe("J11");
    expect(r[0].description).toMatch(/gripe|influenza/i);
  });

  it("acha por descrição, sem acento", () => {
    // "episódio" tem acento no catálogo; a busca normaliza e deve achar F32.
    const r = searchCid("episodio");
    expect(r.some((c) => c.code === "F32")).toBe(true);
  });

  it("prioriza correspondência por código antes da descrição", () => {
    const r = searchCid("I10");
    expect(r[0].code).toBe("I10");
  });

  it("termo curto → vazio", () => {
    expect(searchCid("a")).toEqual([]);
  });

  it("respeita o limite", () => {
    expect(searchCid("a", 5).length).toBeLessThanOrEqual(5);
    expect(searchCid("dor", 3).length).toBeLessThanOrEqual(3);
  });
});

describe("findCid", () => {
  it("acha exato ignorando caixa/acento", () => {
    expect(findCid("e11")?.description).toMatch(/diabetes/i);
    expect(findCid("ZZZ")).toBeUndefined();
  });
});

describe("suggestCidFromText", () => {
  it("sugere pelo vocabulário da descrição presente no texto", () => {
    const r = suggestCidFromText("Paciente com gripe e febre há 2 dias");
    const codes = r.map((c) => c.code);
    expect(codes).toContain("J11"); // Influenza (gripe)
    expect(codes).toContain("R50"); // Febre
  });

  it("acha hipertensão pela descrição", () => {
    const r = suggestCidFromText("quadro de hipertensão essencial");
    expect(r.some((c) => c.code === "I10")).toBe(true);
  });

  it("texto curto ou sem termos → vazio", () => {
    expect(suggestCidFromText("ok")).toEqual([]);
    expect(suggestCidFromText("xyzzy nada aqui plumbus")).toEqual([]);
  });

  it("respeita o limite", () => {
    expect(suggestCidFromText("dor febre tosse ansiedade gripe diabetes", 2).length).toBeLessThanOrEqual(2);
  });
});

describe("CID10_CATALOG", () => {
  it("não tem códigos duplicados", () => {
    const codes = CID10_CATALOG.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
