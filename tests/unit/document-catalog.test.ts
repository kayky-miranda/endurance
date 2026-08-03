import { describe, it, expect } from "vitest";
import {
  DOCUMENTS,
  DOCUMENT_TYPES,
  documentById,
  isDocumentType,
  parseDocSelection,
} from "@/lib/endurance/document-catalog";

describe("catálogo de documentos", () => {
  it("todo tipo declarado tem definição correspondente", () => {
    for (const t of DOCUMENT_TYPES) expect(documentById(t)).toBeDefined();
    expect(DOCUMENTS).toHaveLength(DOCUMENT_TYPES.length);
  });

  it("toda definição aponta para um módulo (base do gate de permissão)", () => {
    for (const d of DOCUMENTS) {
      expect(d.module.length).toBeGreaterThan(0);
      expect(d.title.length).toBeGreaterThan(0);
    }
  });

  it("documentos não assinados são os que não têm responsabilidade técnica", () => {
    // Ficha cadastral e histórico são extratos de dado, não peças assinadas.
    expect(documentById("ficha-cadastral")?.signed).toBe(false);
    expect(documentById("historico-consultas")?.signed).toBe(false);
    expect(documentById("declaracao-comparecimento")?.signed).toBe(true);
    expect(documentById("prontuario")?.signed).toBe(true);
  });

  it("isDocumentType rejeita entrada desconhecida", () => {
    expect(isDocumentType("anamnese")).toBe(true);
    expect(isDocumentType("../../etc/passwd")).toBe(false);
    expect(isDocumentType("")).toBe(false);
  });
});

describe("parseDocSelection (impressão em lote)", () => {
  it("ignora ids inválidos em vez de quebrar", () => {
    expect(parseDocSelection("anamnese,inexistente,prontuario")).toEqual([
      "anamnese",
      "prontuario",
    ]);
  });

  it("preserva a ordem do catálogo, não a da query", () => {
    // O usuário marca em qualquer ordem; o PDF sai numa sequência estável.
    const a = parseDocSelection("prontuario,anamnese");
    const b = parseDocSelection("anamnese,prontuario");
    expect(a).toEqual(b);
  });

  it("remove duplicatas", () => {
    expect(parseDocSelection("anamnese,anamnese")).toEqual(["anamnese"]);
  });

  it("vazio ou ausente devolve lista vazia", () => {
    expect(parseDocSelection("")).toEqual([]);
    expect(parseDocSelection(undefined)).toEqual([]);
    expect(parseDocSelection(",,,")).toEqual([]);
  });
});
