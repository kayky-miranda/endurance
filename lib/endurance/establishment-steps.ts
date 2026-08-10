/**
 * Etapas do cadastro do estabelecimento — regra PURA, testável sem banco.
 *
 * O estado de cada etapa é DERIVADO da prontidão fiscal (`fiscal-readiness`),
 * nunca calculado de novo. Se a etapa tivesse a própria lista de campos, as
 * duas divergiriam na primeira mudança de regra — e o cliente veria "etapa
 * completa" ao lado de "não é possível emitir".
 *
 * Etapas que não bloqueiam emissão nenhuma (contatos, integrações) são
 * marcadas como opcionais: exibi-las com ❌ faria o cliente achar que está
 * impedido de operar quando não está.
 */

import type { DocReadiness, Requirement } from "./fiscal-readiness";

export type StepId =
  | "empresa"
  | "endereco"
  | "fiscal"
  | "certificado"
  | "emissao"
  | "integracoes"
  | "revisao";

export interface StepDef {
  id: StepId;
  label: string;
  description: string;
  /** Etapa que nunca bloqueia emissão. */
  optional?: boolean;
}

export const STEPS: StepDef[] = [
  {
    id: "empresa",
    label: "Dados da empresa",
    description: "Identificação jurídica, contato e responsável legal.",
  },
  {
    id: "endereco",
    label: "Endereço",
    description: "Endereço fiscal do estabelecimento emitente.",
  },
  {
    id: "fiscal",
    label: "Dados fiscais",
    description: "Regime tributário, inscrições e parâmetros da nota.",
  },
  {
    id: "certificado",
    label: "Certificado digital",
    description: "Certificado A1 que assina os documentos.",
  },
  {
    id: "emissao",
    label: "Emissão",
    description: "Série, numeração e ambiente.",
  },
  {
    id: "integracoes",
    label: "Integrações",
    description: "Provedor de emissão e status da conexão.",
    optional: true,
  },
  {
    id: "revisao",
    label: "Revisão",
    description: "Checklist de prontidão fiscal.",
  },
];

export type StepStatus = "completo" | "pendente" | "bloqueado" | "opcional";

export interface StepState {
  step: StepDef;
  status: StepStatus;
  /** Pendências bloqueantes desta etapa (vindas da prontidão). */
  blocking: Requirement[];
  /** Ressalvas não bloqueantes desta etapa. */
  warnings: Requirement[];
}

/**
 * Junta as pendências de TODOS os documentos suportados e as distribui pelas
 * etapas. Documento não suportado fica de fora: pendência de algo que o sistema
 * não emite não é pendência do cliente.
 */
export function computeSteps(docs: DocReadiness[]): StepState[] {
  const suportados = docs.filter((d) => d.supported);

  const blockingByStep = new Map<string, Map<string, Requirement>>();
  const warningByStep = new Map<string, Map<string, Requirement>>();

  const push = (
    map: Map<string, Map<string, Requirement>>,
    r: Requirement,
  ) => {
    const bucket = map.get(r.step) ?? new Map<string, Requirement>();
    // Chave pelo campo: o mesmo requisito aparece em vários documentos.
    bucket.set(r.field, r);
    map.set(r.step, bucket);
  };

  for (const d of suportados) {
    for (const r of d.pending) push(blockingByStep, r);
    for (const w of d.warnings) push(warningByStep, w);
  }

  return STEPS.map((step) => {
    const blocking = [...(blockingByStep.get(step.id)?.values() ?? [])];
    const warnings = [...(warningByStep.get(step.id)?.values() ?? [])];

    // A revisão espelha o conjunto: fica completa quando tudo mais está.
    if (step.id === "revisao") {
      const totalBloqueios = [...blockingByStep.values()].reduce(
        (n, m) => n + m.size,
        0,
      );
      return {
        step,
        status: totalBloqueios > 0 ? "bloqueado" : "completo",
        blocking: [],
        warnings: [],
      };
    }

    let status: StepStatus;
    if (blocking.length > 0) status = "bloqueado";
    else if (warnings.length > 0) status = "pendente";
    else if (step.optional) status = "opcional";
    else status = "completo";

    return { step, status, blocking, warnings };
  });
}

/** Primeira etapa que exige ação — para onde levar quem retoma o cadastro. */
export function firstIncompleteStep(states: StepState[]): StepId {
  return (
    states.find((s) => s.status === "bloqueado")?.step.id ??
    states.find((s) => s.status === "pendente")?.step.id ??
    "revisao"
  );
}

/** Percentual concluído — só conta etapas que podem bloquear. */
export function completionPercent(states: StepState[]): number {
  const contam = states.filter((s) => !s.step.optional && s.step.id !== "revisao");
  if (contam.length === 0) return 100;
  const ok = contam.filter((s) => s.status !== "bloqueado").length;
  return Math.round((ok / contam.length) * 100);
}
