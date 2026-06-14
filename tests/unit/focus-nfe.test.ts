import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  buildFocusNfcePayload,
  createFocusNfeProvider,
} from "@/lib/endurance/fiscal-providers/focus-nfe";
import { resolveFiscalProvider } from "@/lib/endurance/fiscal-provider";
import type { NfceEmitInput } from "@/lib/endurance/fiscal-provider";

const INPUT: NfceEmitInput = {
  ref: "sale_1",
  ambiente: "homologacao",
  emissao: new Date("2026-06-13T10:00:00-03:00"),
  emit: { cnpj: "14.200.166/0001-87", ie: "ISENTO", crt: "1", uf: "SP" },
  dest: null,
  itens: [
    {
      codigo: "P1",
      descricao: "Refrigerante 2L",
      ncm: "22021000",
      cfop: "5102",
      unidade: "UN",
      quantidade: 1,
      valorUnitario: 10,
    },
  ],
  pagamentos: [{ metodo: "dinheiro", valor: 10 }],
  subtotal: 10,
  desconto: 0,
  total: 10,
};

/** fetch falso: delega a um handler que decide a resposta por método/URL. */
function fakeFetch(
  handler: (url: string, init: { method: string }) => { ok?: boolean; body?: unknown },
): typeof fetch {
  return (async (url: string, init: { method: string }) => {
    const r = handler(String(url), init);
    return {
      ok: r.ok ?? true,
      json: async () => r.body ?? {},
    } as Response;
  }) as unknown as typeof fetch;
}

describe("buildFocusNfcePayload", () => {
  it("mapeia a venda para o payload do Focus", () => {
    const p = buildFocusNfcePayload(INPUT);
    expect(p.cnpj_emitente).toBe("14200166000187");
    expect(p.valor_total).toBe(10);
    expect(p.formas_pagamento[0].forma_pagamento).toBe("01"); // dinheiro
    const item = p.items[0];
    expect(item.codigo_ncm).toBe("22021000");
    expect(item.cfop).toBe("5102");
    expect(item.icms_situacao_tributaria).toBe("102"); // Simples Nacional
    expect(item.valor_bruto).toBe(10);
  });

  it("inclui o destinatário quando há CPF", () => {
    const p = buildFocusNfcePayload({
      ...INPUT,
      dest: { nome: "Fulano", doc: "390.533.447-05" },
    });
    expect(p.cpf_destinatario).toBe("39053344705");
    expect(p.nome_destinatario).toBe("Fulano");
  });
});

describe("createFocusNfeProvider.emitNfce", () => {
  it("autoriza: POST processando → consulta autorizado", async () => {
    const provider = createFocusNfeProvider({
      token: "t",
      baseUrl: "https://homologacao.focusnfe.com.br",
      sleepImpl: async () => {},
      pollDelayMs: 0,
      maxPolls: 3,
      fetchImpl: fakeFetch((_url, init) => {
        if (init.method === "POST")
          return { body: { status: "processando_autorizacao" } };
        return {
          body: {
            status: "autorizado",
            chave_nfe: "35260614200166000187650010000000421234567890",
            numero: "42",
            serie: "1",
            protocolo: "135260000000001",
            qrcode: "http://qr.example/p=...",
            caminho_danfe: "/v2/danfes/abc.pdf",
            caminho_xml_nota_fiscal: "/v2/xmls/abc.xml",
          },
        };
      }),
    });

    const r = await provider.emitNfce(INPUT);
    expect(r.status).toBe("autorizado");
    expect(r.chave).toBe("35260614200166000187650010000000421234567890");
    expect(r.numero).toBe(42);
    expect(r.danfeUrl).toBe(
      "https://homologacao.focusnfe.com.br/v2/danfes/abc.pdf",
    );
  });

  it("propaga rejeição da SEFAZ", async () => {
    const provider = createFocusNfeProvider({
      token: "t",
      baseUrl: "https://homologacao.focusnfe.com.br",
      sleepImpl: async () => {},
      fetchImpl: fakeFetch(() => ({
        ok: false,
        body: { status: "erro_autorizacao", mensagem_sefaz: "NCM invalido" },
      })),
    });
    const r = await provider.emitNfce(INPUT);
    expect(r.status).toBe("rejeitado");
    expect(r.mensagem).toContain("NCM");
  });

  it("devolve processando quando não autoriza a tempo", async () => {
    const provider = createFocusNfeProvider({
      token: "t",
      baseUrl: "https://homologacao.focusnfe.com.br",
      sleepImpl: async () => {},
      pollDelayMs: 0,
      maxPolls: 2,
      fetchImpl: fakeFetch(() => ({
        body: { status: "processando_autorizacao" },
      })),
    });
    const r = await provider.emitNfce(INPUT);
    expect(r.status).toBe("processando");
  });
});

describe("createFocusNfeProvider.cancelNfce", () => {
  it("cancela com sucesso", async () => {
    const provider = createFocusNfeProvider({
      token: "t",
      baseUrl: "https://homologacao.focusnfe.com.br",
      fetchImpl: fakeFetch(() => ({ body: { status: "cancelado" } })),
    });
    const r = await provider.cancelNfce("sale_1", "Cancelamento de teste valido");
    expect(r.ok).toBe(true);
  });

  it("propaga erro de cancelamento", async () => {
    const provider = createFocusNfeProvider({
      token: "t",
      baseUrl: "https://homologacao.focusnfe.com.br",
      fetchImpl: fakeFetch(() => ({
        ok: false,
        body: { status: "erro_cancelamento", mensagem_sefaz: "Prazo expirado" },
      })),
    });
    const r = await provider.cancelNfce("sale_1", "Cancelamento de teste valido");
    expect(r.ok).toBe(false);
    expect(r.mensagem).toContain("Prazo");
  });
});

describe("resolveFiscalProvider (gating)", () => {
  const ENV = [
    "FOCUS_NFE_TOKEN_HOMOLOGACAO",
    "FOCUS_NFE_TOKEN_PRODUCAO",
    "FOCUS_NFE_ALLOW_PRODUCTION",
  ];
  let saved: Record<string, string | undefined>;
  beforeEach(() => {
    saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
    ENV.forEach((k) => delete process.env[k]);
  });
  afterEach(() => {
    ENV.forEach((k) => {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    });
  });

  it("provider vazio → simula", () => {
    expect(resolveFiscalProvider({ provider: "", ambiente: "2" }).kind).toBe(
      "simulate",
    );
  });

  it("focusnfe sem token → erro (não simula silenciosamente)", () => {
    expect(
      resolveFiscalProvider({ provider: "focusnfe", ambiente: "2" }).kind,
    ).toBe("error");
  });

  it("focusnfe com token de homologação → provider", () => {
    process.env.FOCUS_NFE_TOKEN_HOMOLOGACAO = "tok";
    const r = resolveFiscalProvider({ provider: "focusnfe", ambiente: "2" });
    expect(r.kind).toBe("provider");
  });

  it("produção bloqueada sem a flag explícita", () => {
    process.env.FOCUS_NFE_TOKEN_PRODUCAO = "ptok";
    const r = resolveFiscalProvider({ provider: "focusnfe", ambiente: "1" });
    expect(r.kind).toBe("error");
  });

  it("produção liberada com flag + token", () => {
    process.env.FOCUS_NFE_TOKEN_PRODUCAO = "ptok";
    process.env.FOCUS_NFE_ALLOW_PRODUCTION = "true";
    const r = resolveFiscalProvider({ provider: "focusnfe", ambiente: "1" });
    expect(r.kind).toBe("provider");
  });
});
