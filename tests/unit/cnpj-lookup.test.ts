import { describe, it, expect, vi } from "vitest";
import { lookupCnpj, lookupCep } from "@/lib/endurance/cnpj-lookup";

const CNPJ_OK = "11.222.333/0001-81";

const brasilApiBody = {
  cnpj: "11222333000181",
  razao_social: "MERCADINHO EXEMPLO LTDA",
  nome_fantasia: "Mercadinho do Zé",
  logradouro: "RUA DAS FLORES",
  numero: "123",
  bairro: "CENTRO",
  municipio: "CAMPINAS",
  uf: "sp",
  cep: "13010-000",
  ddd_telefone_1: "1932220000",
  email: "contato@exemplo.com.br",
  codigo_municipio_ibge: 3509502,
  descricao_situacao_cadastral: "ATIVA",
};

const jsonRes = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as unknown as Response;

describe("lookupCnpj", () => {
  it("normaliza a resposta da BrasilAPI (endereço, UF, IBGE como string)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonRes(brasilApiBody));
    const r = await lookupCnpj(CNPJ_OK, { fetchImpl: fetchImpl as typeof fetch });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.razaoSocial).toBe("MERCADINHO EXEMPLO LTDA");
      expect(r.data.address).toBe("RUA DAS FLORES, 123, CENTRO");
      expect(r.data.state).toBe("SP");
      expect(r.data.zip).toBe("13010000");
      expect(r.data.codigoMunicipioIbge).toBe("3509502");
      expect(r.data.situacao).toBe("ATIVA");
    }
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://brasilapi.com.br/api/cnpj/v1/11222333000181",
      expect.anything(),
    );
  });

  it("rejeita CNPJ inválido sem ir à rede", async () => {
    const fetchImpl = vi.fn();
    const r = await lookupCnpj("12.345.678/0001-00", {
      fetchImpl: fetchImpl as typeof fetch,
    });
    expect(r.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("404 vira 'não encontrado'; erro de rede vira mensagem amigável", async () => {
    const notFound = await lookupCnpj(CNPJ_OK, {
      fetchImpl: vi.fn().mockResolvedValue(jsonRes({}, 404)) as typeof fetch,
    });
    expect(notFound).toEqual({ ok: false, error: "CNPJ não encontrado na Receita." });

    const network = await lookupCnpj(CNPJ_OK, {
      fetchImpl: vi.fn().mockRejectedValue(new Error("ETIMEDOUT")) as typeof fetch,
    });
    expect(network.ok).toBe(false);
  });
});

describe("lookupCep", () => {
  it("normaliza a resposta do ViaCEP", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonRes({ logradouro: "Rua A", bairro: "Centro", localidade: "Campinas", uf: "SP" }),
    );
    const r = await lookupCep("13010-000", { fetchImpl: fetchImpl as typeof fetch });
    expect(r).toEqual({
      ok: true,
      data: {
        zip: "13010000",
        // Linha única, para telas que mostram o endereço junto.
        address: "Rua A, Centro",
        // SEPARADOS — a NF-e exige logradouro e bairro em campos próprios. Sem
        // isto o cadastro fiscal punha o bairro dentro do logradouro e deixava
        // o campo Bairro vazio, seguindo como pendência.
        street: "Rua A",
        district: "Centro",
        city: "Campinas",
        state: "SP",
      },
    });
  });

  it("CEP sem bairro não inventa dado nem quebra", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonRes({ logradouro: "Rua B", localidade: "Santos", uf: "SP" }),
    );
    const r = await lookupCep("11010-000", { fetchImpl: fetchImpl as typeof fetch });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.street).toBe("Rua B");
      expect(r.data.district).toBe("");
      expect(r.data.address).toBe("Rua B");
    }
  });

  it("CEP inexistente (erro:true) e CEP malformado", async () => {
    const missing = await lookupCep("99999999", {
      fetchImpl: vi.fn().mockResolvedValue(jsonRes({ erro: true })) as typeof fetch,
    });
    expect(missing).toEqual({ ok: false, error: "CEP não encontrado." });

    const bad = await lookupCep("123", { fetchImpl: vi.fn() as typeof fetch });
    expect(bad.ok).toBe(false);
  });
});
