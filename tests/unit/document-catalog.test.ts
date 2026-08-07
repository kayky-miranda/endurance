import { describe, it, expect } from "vitest";
import {
  DOCUMENTS,
  DOCUMENT_TYPES,
  documentById,
  documentsFor,
  documentsOfModule,
  isDocumentType,
  parseDocSelection,
} from "@/lib/endurance/document-catalog";
import { MODULES } from "@/lib/endurance/catalog";

describe("catálogo de documentos", () => {
  it("todo tipo declarado tem definição correspondente", () => {
    for (const t of DOCUMENT_TYPES) expect(documentById(t)).toBeDefined();
    expect(DOCUMENTS).toHaveLength(DOCUMENT_TYPES.length);
  });

  it("toda definição aponta para um módulo QUE EXISTE no catálogo", () => {
    // O gate do documento é `canAccessModule(role, perms, def.module)`. Um id de
    // módulo escrito errado não dá erro: simplesmente nunca libera, e o
    // documento some da tela sem explicação.
    const modulos = new Set(MODULES.map((m) => m.id));
    for (const d of DOCUMENTS) {
      expect(modulos.has(d.module), `${d.id} → ${d.module}`).toBe(true);
      expect(d.title.length).toBeGreaterThan(0);
      expect(d.label.length).toBeGreaterThan(0);
      expect(d.description.length).toBeGreaterThan(0);
    }
  });

  it("documentsOfModule devolve o que o módulo imprime", () => {
    expect(documentsOfModule("planos_alimentares")).toEqual(["plano-alimentar"]);
    expect(documentsOfModule("treinos")).toEqual(["prescricao-treino"]);
    expect(documentsOfModule("modulo_inexistente")).toEqual([]);
  });

  it("documentsFor respeita o acesso a módulo", () => {
    const soClinico = documentsFor((m) => m === "prontuario");
    expect(soClinico).toContain("prontuario");
    expect(soClinico).not.toContain("ficha-cadastral");
    expect(documentsFor(() => false)).toEqual([]);
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
