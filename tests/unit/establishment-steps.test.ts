import { describe, it, expect } from "vitest";
import {
  STEPS,
  computeSteps,
  firstIncompleteStep,
  completionPercent,
} from "@/lib/endurance/establishment-steps";
import type { DocReadiness, Requirement } from "@/lib/endurance/fiscal-readiness";

const req = (
  field: string,
  step: Requirement["step"],
  blocking = true,
): Requirement => ({ field, label: field, step, blocking });

const doc = (
  over: Partial<DocReadiness> & Pick<DocReadiness, "doc">,
): DocReadiness => ({
  label: over.doc,
  supported: true,
  ready: true,
  pending: [],
  warnings: [],
  ...over,
});

/**
 * O estado das etapas é DERIVADO da prontidão fiscal. Se fosse recalculado, as
 * duas divergiriam na primeira mudança de regra e o cliente veria "etapa
 * completa" ao lado de "não é possível emitir".
 */
describe("etapas do cadastro", () => {
  it("distribui as pendências pelas etapas certas", () => {
    const s = computeSteps([
      doc({
        doc: "nfce",
        ready: false,
        pending: [req("cnpj", "empresa"), req("cep", "endereco"), req("csc", "fiscal")],
      }),
    ]);
    const byId = Object.fromEntries(s.map((x) => [x.step.id, x]));
    expect(byId.empresa.status).toBe("bloqueado");
    expect(byId.endereco.status).toBe("bloqueado");
    expect(byId.fiscal.status).toBe("bloqueado");
    expect(byId.certificado.status).toBe("completo");
  });

  it("não repete o requisito que aparece em vários documentos", () => {
    const s = computeSteps([
      doc({ doc: "nfce", ready: false, pending: [req("cnpj", "empresa")] }),
      doc({ doc: "nfe", ready: false, pending: [req("cnpj", "empresa")] }),
    ]);
    const empresa = s.find((x) => x.step.id === "empresa")!;
    expect(empresa.blocking).toHaveLength(1);
  });

  it("IGNORA pendência de documento que o sistema não emite", () => {
    // Cobrar Inscrição Municipal por causa da NFS-e, que o ERP não emite,
    // mandaria o cliente resolver algo que não vai usar.
    const s = computeSteps([
      doc({ doc: "nfce", ready: true }),
      doc({
        doc: "nfse",
        supported: false,
        ready: false,
        pending: [req("inscricaoMunicipal", "fiscal")],
      }),
    ]);
    expect(s.find((x) => x.step.id === "fiscal")!.status).toBe("completo");
  });

  it("ressalva vira 'pendente', não 'bloqueado'", () => {
    const s = computeSteps([
      doc({ doc: "nfce", ready: true, warnings: [req("ambiente", "emissao", false)] }),
    ]);
    expect(s.find((x) => x.step.id === "emissao")!.status).toBe("pendente");
  });

  it("etapa opcional nunca aparece como bloqueada", () => {
    const s = computeSteps([doc({ doc: "nfce", ready: true })]);
    const integracoes = s.find((x) => x.step.id === "integracoes")!;
    expect(integracoes.step.optional).toBe(true);
    expect(integracoes.status).toBe("opcional");
  });

  it("a revisão espelha o conjunto", () => {
    const ok = computeSteps([doc({ doc: "nfce", ready: true })]);
    expect(ok.find((x) => x.step.id === "revisao")!.status).toBe("completo");

    const ruim = computeSteps([
      doc({ doc: "nfce", ready: false, pending: [req("cnpj", "empresa")] }),
    ]);
    expect(ruim.find((x) => x.step.id === "revisao")!.status).toBe("bloqueado");
  });

  it("leva quem retoma para a primeira etapa que exige ação", () => {
    const s = computeSteps([
      doc({
        doc: "nfce",
        ready: false,
        pending: [req("csc", "fiscal")],
        warnings: [req("ambiente", "emissao", false)],
      }),
    ]);
    // Bloqueio vem antes de ressalva.
    expect(firstIncompleteStep(s)).toBe("fiscal");
  });

  it("cadastro completo aponta para a revisão", () => {
    expect(firstIncompleteStep(computeSteps([doc({ doc: "nfce", ready: true })]))).toBe(
      "revisao",
    );
  });

  it("o percentual só conta etapas que podem bloquear", () => {
    expect(completionPercent(computeSteps([doc({ doc: "nfce", ready: true })]))).toBe(100);
    const parcial = computeSteps([
      doc({
        doc: "nfce",
        ready: false,
        pending: [req("cnpj", "empresa"), req("cep", "endereco")],
      }),
    ]);
    // 5 etapas contam (empresa, endereço, fiscal, certificado, emissão); 2 travadas.
    expect(completionPercent(parcial)).toBe(60);
  });

  it("as 7 etapas do cadastro estão declaradas e são únicas", () => {
    expect(STEPS).toHaveLength(7);
    expect(new Set(STEPS.map((s) => s.id)).size).toBe(7);
  });
});
