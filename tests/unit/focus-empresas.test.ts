import { describe, it, expect, vi } from "vitest";
import { registerCompany } from "@/lib/endurance/fiscal-providers/focus-empresas";

/**
 * Cadastro multiempresa no provedor. Sem conta de parceiro não dá para bater na
 * API de verdade (nem o dry_run responde sem token válido), então o `fetch` é
 * injetado: o que se prova aqui é o payload, o modo simulado e a tradução dos
 * erros — tudo menos a resposta real do provedor.
 */

const entrada = {
  cnpj: "11.222.333/0001-81",
  razaoSocial: "Mercado Teste LTDA",
  nomeFantasia: "Mercadinho",
  inscricaoEstadual: "123.456.789",
  regimeTributario: "1",
  uf: "sp",
  municipio: "São Paulo",
  codigoMunicipio: "3550308",
  cep: "01310-100",
  logradouro: "Av. Paulista",
  numero: "1000",
  bairro: "Bela Vista",
  email: "fiscal@exemplo.com",
  certificadoBase64: "QkFTRTY0",
  certificadoSenha: "senha-secreta",
};

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  ) as unknown as typeof fetch;
}

describe("cadastro de empresa no provedor", () => {
  it("autentica com Basic Auth: token no usuário, senha em branco", async () => {
    const f = fakeFetch(200, { id: 7 });
    await registerCompany("TOKEN_PARCEIRO", entrada, { fetchImpl: f });

    const [, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const auth = (init.headers as Record<string, string>).Authorization;
    expect(auth.startsWith("Basic ")).toBe(true);
    expect(
      Buffer.from(auth.replace("Basic ", ""), "base64").toString(),
    ).toBe("TOKEN_PARCEIRO:");
  });

  it("envia certificado e senha nos campos que o provedor espera", async () => {
    const f = fakeFetch(200, { id: 7 });
    await registerCompany("T", entrada, { fetchImpl: f });

    const [, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.arquivo_certificado_base64).toBe("QkFTRTY0");
    expect(body.senha_certificado).toBe("senha-secreta");
  });

  it("normaliza documentos e UF antes de enviar", async () => {
    const f = fakeFetch(200, { id: 7 });
    await registerCompany("T", entrada, { fetchImpl: f });

    const [, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.cnpj).toBe("11222333000181");
    expect(body.inscricao_estadual).toBe("123456789");
    expect(body.cep).toBe("01310100");
    expect(body.uf).toBe("SP");
  });

  it("dry_run vai na URL e é sinalizado no retorno", async () => {
    const f = fakeFetch(200, { id: 7 });
    const r = await registerCompany("T", entrada, { dryRun: true, fetchImpl: f });

    const [url] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain("dry_run=1");
    expect(r.dryRun).toBe(true);
  });

  it("sem dry_run a URL fica limpa", async () => {
    const f = fakeFetch(200, { id: 7 });
    const r = await registerCompany("T", entrada, { fetchImpl: f });
    const [url] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).not.toContain("dry_run");
    expect(r.dryRun).toBe(false);
  });

  it("lê tokens por empresa e a validade do certificado", async () => {
    const f = fakeFetch(200, {
      id: 42,
      token_producao: "tok_prod",
      token_homologacao: "tok_homo",
      certificado_valido_de: "2026-04-01T15:03:25-03:00",
      certificado_valido_ate: "2027-04-01T15:03:25-03:00",
    });
    const r = await registerCompany("T", entrada, { fetchImpl: f });

    expect(r.ok).toBe(true);
    expect(r.empresaId).toBe("42");
    expect(r.tokenProducao).toBe("tok_prod");
    expect(r.tokenHomologacao).toBe("tok_homo");
    expect(r.certValidoAte?.getFullYear()).toBe(2027);
  });

  it("data inválida não vira Invalid Date silencioso", async () => {
    const f = fakeFetch(200, { id: 1, certificado_valido_ate: "não é data" });
    const r = await registerCompany("T", entrada, { fetchImpl: f });
    expect(r.certValidoAte).toBeUndefined();
  });

  it("traduz erro por campo do provedor", async () => {
    const f = fakeFetch(422, {
      erros: [{ campo: "senha_certificado", mensagem: "senha incorreta" }],
    });
    const r = await registerCompany("T", entrada, { fetchImpl: f });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("senha_certificado");
    expect(r.error).toContain("senha incorreta");
  });

  it("401 aponta o token de PARCEIRO, não o do cliente", async () => {
    const f = fakeFetch(401, {});
    const r = await registerCompany("T", entrada, { fetchImpl: f });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/parceiro/i);
  });

  it("falha de rede não vaza exceção para a tela", async () => {
    const f = vi.fn(async () => {
      throw new Error("ECONNRESET");
    }) as unknown as typeof fetch;
    const r = await registerCompany("T", entrada, { fetchImpl: f });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/provedor fiscal/i);
  });
});
