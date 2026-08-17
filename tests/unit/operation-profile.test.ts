import { describe, it, expect } from "vitest";
import {
  readOperation,
  hasProfile,
  modulesForAreas,
} from "@/lib/endurance/operation-profile";
import { allModuleIds } from "@/lib/endurance/catalog";

/**
 * A tela de análise afirma coisas sobre a empresa do cliente ("modelo B2B",
 * "indústria"). Cada afirmação precisa sair de algo que ele escreveu — por
 * isso a leitura é pura e testável, e não uma inferência da IA que muda
 * conforme a chave de API esteja configurada.
 */

describe("tipo de operação", () => {
  it("reconhece indústria sem confundir com comércio", () => {
    const p = readOperation(
      "Somos uma indústria de peças automotivas com produção própria.",
    );
    expect(p.kind).toBe("Indústria");
  });

  it("distribuidora vence 'vendemos', que quase todo mundo escreve", () => {
    const p = readOperation("Distribuidora de bebidas, vendemos para lojas.");
    expect(p.kind).toBe("Distribuidora");
  });

  it("reconhece prestador de serviço", () => {
    expect(readOperation("Consultoria contábil para empresas.").kind).toBe(
      "Prestação de serviços",
    );
  });

  it("reconhece operação logística", () => {
    expect(readOperation("Transportadora com frota própria.").kind).toBe(
      "Operação logística",
    );
  });

  it("comércio continua sendo reconhecido", () => {
    expect(readOperation("Tenho uma loja de roupas.").kind).toBe("Comércio");
  });

  it("texto que não diz o tipo devolve vazio, não 'comércio'", () => {
    // Assumir comércio era exatamente o defeito: o onboarding tratava toda
    // empresa como se tivesse balcão.
    expect(readOperation("Precisamos organizar a empresa.").kind).toBe("");
  });
});

describe("modelo de operação", () => {
  it("B2B quando vende para outras empresas", () => {
    expect(readOperation("Atendemos outras empresas.").model).toBe("B2B");
  });

  it("B2C quando vende ao consumidor final", () => {
    expect(readOperation("Vendemos ao consumidor final.").model).toBe("B2C");
  });

  it("os dois quando o texto cita os dois", () => {
    expect(
      readOperation("Vendemos para revendedores e também ao consumidor final.")
        .model,
    ).toBe("B2B e B2C");
  });

  it("vazio quando o texto não diz — não chuta", () => {
    expect(readOperation("Somos uma fábrica de parafusos.").model).toBe("");
  });
});

describe("áreas identificadas", () => {
  it("só lista o que o texto encosta", () => {
    const p = readOperation(
      "Controlamos estoque, produção e compras. Emitimos nota fiscal.",
    );
    const ids = p.areas.map((a) => a.id);
    expect(ids).toContain("estoque");
    expect(ids).toContain("producao");
    expect(ids).toContain("compras");
    expect(ids).toContain("fiscal");
    expect(ids).not.toContain("agenda");
  });

  it("um prestador não recebe produção nem logística", () => {
    const ids = readOperation(
      "Clínica com agenda de consultas e controle financeiro.",
    ).areas.map((a) => a.id);
    expect(ids).toContain("agenda");
    expect(ids).toContain("financeiro");
    expect(ids).not.toContain("producao");
    expect(ids).not.toContain("logistica");
  });

  it("sem áreas, a frase de necessidades fica vazia em vez de genérica", () => {
    const p = readOperation("Empresa nova.");
    expect(p.areas).toEqual([]);
    expect(p.needs).toBe("");
  });

  it("a frase de necessidades nomeia as áreas encontradas", () => {
    const p = readOperation("Controlamos estoque e financeiro.");
    expect(p.needs).toContain("estoque");
    expect(p.needs).toContain("financeiro");
  });
});

describe("números citados", () => {
  it("lê a quantidade de funcionários", () => {
    expect(
      readOperation("Temos aproximadamente 50 funcionários.").headcount,
    ).toBe(50);
  });

  it("lê a quantidade de filiais", () => {
    expect(readOperation("Somos 3 filiais no estado.").units).toBe(3);
  });

  it("não inventa número quando não há", () => {
    const p = readOperation("Somos uma indústria.");
    expect(p.headcount).toBeNull();
    expect(p.units).toBeNull();
  });
});

describe("módulos a partir das áreas", () => {
  const mods = (texto: string) => modulesForAreas(readOperation(texto).areas);

  it("todo id devolvido existe no catálogo", () => {
    // O onboarding grava esta lista. Um id inventado viraria linha morta em
    // OrgModule e módulo fantasma na barra lateral.
    const validos = new Set(allModuleIds());
    for (const id of mods("Controlamos estoque, produção, compras, vendas, financeiro, fiscal, logística, clientes, agenda e contratos."))
      expect(validos.has(id), id).toBe(true);
  });

  it("uma indústria recebe os módulos operacionais, não só os core", () => {
    // Era o defeito: indústria caía em ramo "outro" e entrava na plataforma
    // com sete módulos, depois de a tela ter listado produção e compras.
    const ids = mods(
      "Indústria de peças com produção própria. Controlamos estoque, compras de matéria-prima e emitimos nota fiscal.",
    );
    expect(ids).toContain("estoque");
    expect(ids).toContain("compras");
    expect(ids).toContain("fornecedores");
    expect(ids).toContain("nfe");
  });

  it("não liga PDV nem fechamento de caixa por causa de 'vendas'", () => {
    // Venda de balcão é uma forma específica de vender. Uma indústria que
    // vende para outras empresas não tem frente de caixa.
    const ids = mods("Vendemos para outras empresas e controlamos o financeiro.");
    expect(ids).not.toContain("pdv");
    expect(ids).not.toContain("caixa");
  });

  it("um prestador de serviços não recebe estoque nem produção", () => {
    const ids = mods("Consultoria com agenda de atendimentos e controle financeiro.");
    expect(ids).toContain("financeiro");
    expect(ids).not.toContain("estoque");
    expect(ids).not.toContain("produtos");
  });

  it("sem áreas identificadas não sugere nada", () => {
    expect(mods("Empresa nova.")).toEqual([]);
  });

  it("não repete id quando duas áreas pedem o mesmo módulo", () => {
    const ids = mods("Controlamos estoque e logística de entregas.");
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("hasProfile", () => {
  it("falso quando nada foi identificado — a tela some em vez de mentir", () => {
    expect(hasProfile(readOperation("oi"))).toBe(false);
  });

  it("verdadeiro com qualquer sinal", () => {
    expect(hasProfile(readOperation("Somos uma indústria."))).toBe(true);
  });
});
