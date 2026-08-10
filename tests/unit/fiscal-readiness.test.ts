import { describe, it, expect } from "vitest";
import {
  evaluateReadiness,
  overallStatus,
  type EstablishmentSnapshot,
} from "@/lib/endurance/fiscal-readiness";

/**
 * O cadastro existe para responder: esta empresa já consegue emitir? E, quando
 * não, o que exatamente falta. Uma lista única de "campos obrigatórios" erraria
 * — as exigências diferem por documento, e o cliente perseguiria campo que
 * nunca vai usar.
 */

const completo: EstablishmentSnapshot = {
  cnpj: "11.222.333/0001-81",
  razaoSocial: "Mercado Teste LTDA",
  ie: "123456789",
  inscricaoMunicipal: "98765",
  cMun: "3550308",
  municipio: "São Paulo",
  uf: "SP",
  cep: "01310-100",
  logradouro: "Av. Paulista",
  numeroEnd: "1000",
  bairro: "Bela Vista",
  crt: "1",
  cscId: "000001",
  csc: "CSC-SECRETO",
  defaultNcm: "22021000",
  provider: "focusnfe",
  ambiente: "1",
  certValidoAte: new Date("2027-01-01"),
  certHabilitado: true,
  respNome: "Fulano de Tal",
  respCpf: "529.982.247-25",
};

const doc = (list: ReturnType<typeof evaluateReadiness>, d: string) =>
  list.find((x) => x.doc === d)!;

describe("prontidão fiscal", () => {
  it("cadastro completo libera NFC-e e NF-e", () => {
    const r = evaluateReadiness(completo);
    expect(doc(r, "nfce").ready).toBe(true);
    expect(doc(r, "nfe").ready).toBe(true);
  });

  it("as exigências DIFEREM por documento", () => {
    // Inscrição Municipal é da NFS-e; não pode bloquear a NFC-e.
    const semIM = evaluateReadiness({ ...completo, inscricaoMunicipal: "" });
    expect(doc(semIM, "nfce").ready).toBe(true);
    expect(doc(semIM, "nfse").pending.some((p) => p.field === "inscricaoMunicipal")).toBe(true);

    // CSC é da NFC-e; não pode bloquear a NF-e.
    const semCsc = evaluateReadiness({ ...completo, csc: "" });
    expect(doc(semCsc, "nfce").ready).toBe(false);
    expect(doc(semCsc, "nfe").ready).toBe(true);

    // Inscrição Estadual não se aplica à NFS-e.
    const semIe = evaluateReadiness({ ...completo, ie: "" });
    expect(doc(semIe, "nfce").ready).toBe(false);
    expect(doc(semIe, "nfse").pending.some((p) => p.field === "ie")).toBe(false);
  });

  it("endereço incompleto barra tudo — é o erro mais comum", () => {
    const r = evaluateReadiness({ ...completo, numeroEnd: "", bairro: "" });
    expect(doc(r, "nfce").ready).toBe(false);
    expect(doc(r, "nfe").ready).toBe(false);
    const campos = doc(r, "nfce").pending.map((p) => p.field);
    expect(campos).toContain("numeroEnd");
    expect(campos).toContain("bairro");
  });

  it("código IBGE precisa ter 7 dígitos — vai direto no XML", () => {
    const r = evaluateReadiness({ ...completo, cMun: "355" });
    expect(doc(r, "nfce").pending.some((p) => p.field === "cMun")).toBe(true);
  });

  it("CNPJ inválido é pego pelos dígitos, não pelo tamanho", () => {
    const r = evaluateReadiness({ ...completo, cnpj: "11111111111111" });
    expect(doc(r, "nfce").pending.some((p) => p.field === "cnpj")).toBe(true);
  });

  it("certificado ausente ou VENCIDO bloqueia", () => {
    const sem = evaluateReadiness({ ...completo, certHabilitado: false });
    expect(doc(sem, "nfce").pending.some((p) => p.field === "certificado")).toBe(true);

    const vencido = evaluateReadiness({
      ...completo,
      certValidoAte: new Date("2020-01-01"),
    });
    expect(doc(vencido, "nfce").pending.some((p) => p.field === "certificado")).toBe(true);
  });

  it("NFS-e não é dada como pronta enquanto o sistema não emite", () => {
    // Marcar "pronto" com tudo preenchido prometeria uma emissão que não existe.
    const r = evaluateReadiness(completo);
    expect(doc(r, "nfse").supported).toBe(false);
    expect(doc(r, "nfse").ready).toBe(false);

    const comSuporte = evaluateReadiness(completo, { nfseSupported: true });
    expect(doc(comSuporte, "nfse").ready).toBe(true);
  });

  it("cada pendência diz ONDE resolver", () => {
    // "dados incompletos" não é mensagem de erro, é adivinhação.
    const r = evaluateReadiness({ ...completo, csc: "", cep: "" });
    for (const p of doc(r, "nfce").pending) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(["empresa", "endereco", "fiscal", "certificado", "emissao"]).toContain(p.step);
    }
  });

  it("não repete o mesmo requisito em documentos diferentes", () => {
    const r = evaluateReadiness({ ...completo, cnpj: "" });
    const campos = doc(r, "nfce").pending.map((p) => p.field);
    expect(new Set(campos).size).toBe(campos.length);
  });

  it("homologação é AVISO, não bloqueio — é onde se testa", () => {
    const r = evaluateReadiness({ ...completo, ambiente: "2" });
    expect(doc(r, "nfce").ready).toBe(true);
    expect(doc(r, "nfce").warnings.some((w) => w.field === "ambiente")).toBe(true);
  });

  it("responsável legal é recomendação, não trava a emissão", () => {
    const r = evaluateReadiness({ ...completo, respNome: "", respCpf: "" });
    expect(doc(r, "nfce").ready).toBe(true);
    expect(doc(r, "nfce").warnings.some((w) => w.field === "responsavel")).toBe(true);
  });
});

describe("semáforo do cadastro", () => {
  it("completo quando tudo que o sistema suporta emite sem ressalva", () => {
    expect(overallStatus(evaluateReadiness(completo))).toBe("completo");
  });

  it("pendente quando parte emite", () => {
    const r = evaluateReadiness({ ...completo, csc: "" });
    expect(overallStatus(r)).toBe("pendente");
  });

  it("bloqueado quando nada sai", () => {
    const r = evaluateReadiness({ ...completo, cnpj: "", certHabilitado: false });
    expect(overallStatus(r)).toBe("bloqueado");
  });
});
