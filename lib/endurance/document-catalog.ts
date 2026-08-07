/**
 * Catálogo dos documentos imprimíveis — PURO (serve cliente e servidor).
 *
 * Fonte única do que existe para imprimir: a rota `/documento/[tipo]/[id]` usa
 * para despachar, a UI usa para montar os botões e a impressão em lote usa para
 * validar a seleção. Acrescentar um documento é uma entrada aqui + um
 * renderizador — nada de espalhar rotas soltas pelo sistema.
 */

export const DOCUMENT_TYPES = [
  "declaracao-comparecimento",
  "solicitacao-exames",
  "anamnese",
  "prontuario",
  "ficha-cadastral",
  "historico-consultas",
  "resultados-exames",
  "evolucao",
  "plano-alimentar",
  "prescricao-treino",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export interface DocumentDef {
  id: DocumentType;
  label: string;
  /** Título impresso no documento. */
  title: string;
  description: string;
  /** Assinado pelo profissional? Declaração sim; ficha cadastral não. */
  signed: boolean;
  /** Módulo cuja permissão libera o documento (via MODULE_PERMISSION). */
  module: string;
}

export const DOCUMENTS: DocumentDef[] = [
  {
    id: "declaracao-comparecimento",
    label: "Declaração de comparecimento",
    title: "Declaração de comparecimento",
    description: "Comprova que o paciente esteve na consulta.",
    signed: true,
    module: "agenda_consultas",
  },
  {
    id: "solicitacao-exames",
    label: "Solicitação de exames",
    title: "Solicitação de exames",
    description: "Pedido de exames com espaço para a relação.",
    signed: true,
    module: "prontuario",
  },
  {
    id: "anamnese",
    label: "Anamnese completa",
    title: "Anamnese",
    description: "Questionário inicial com todas as respostas.",
    signed: true,
    module: "anamnese",
  },
  {
    id: "prontuario",
    label: "Prontuário",
    title: "Prontuário clínico",
    description: "Anotações clínicas do paciente.",
    signed: true,
    module: "prontuario",
  },
  {
    id: "evolucao",
    label: "Evolução do paciente",
    title: "Evolução do paciente",
    description: "Medições acompanhadas e sua variação.",
    signed: true,
    module: "evolucao",
  },
  {
    id: "plano-alimentar",
    label: "Plano alimentar",
    title: "Plano alimentar",
    description: "Cardápio prescrito, refeição por refeição.",
    signed: true,
    module: "planos_alimentares",
  },
  {
    id: "prescricao-treino",
    label: "Prescrição de exercícios",
    title: "Prescrição de exercícios",
    description: "Ficha de treino com séries, carga e descanso.",
    signed: true,
    module: "treinos",
  },
  {
    id: "resultados-exames",
    label: "Resultados de exames",
    title: "Resultados de exames laboratoriais",
    description: "Resultados registrados com faixa de referência.",
    signed: true,
    module: "prontuario",
  },
  {
    id: "historico-consultas",
    label: "Histórico de consultas",
    title: "Histórico de consultas",
    description: "Todos os atendimentos e seus status.",
    signed: false,
    module: "agenda_consultas",
  },
  {
    id: "ficha-cadastral",
    label: "Ficha cadastral",
    title: "Ficha cadastral do paciente",
    description: "Dados pessoais, endereço e convênio.",
    signed: false,
    module: "pacientes",
  },
];

const BY_ID = new Map(DOCUMENTS.map((d) => [d.id, d]));

/**
 * Documentos liberados para um perfil. Recebe o teste de acesso pronto em vez
 * da sessão para continuar puro — quem chama é sempre servidor e já sabe
 * responder "esse perfil abre esse módulo?".
 *
 * Existe para o filtro não ser reescrito em cada página que oferece impressão;
 * era assim que uma tela acabava oferecendo documento que outra escondia.
 */
export function documentsFor(
  canAccess: (moduleId: string) => boolean,
): DocumentType[] {
  return DOCUMENTS.filter((d) => canAccess(d.module)).map((d) => d.id);
}

/** Documentos que "pertencem" a um módulo — os que ele imprime por natureza. */
export function documentsOfModule(moduleId: string): DocumentType[] {
  return DOCUMENTS.filter((d) => d.module === moduleId).map((d) => d.id);
}

export function documentById(id: string): DocumentDef | undefined {
  return BY_ID.get(id as DocumentType);
}

export function isDocumentType(v: string): v is DocumentType {
  return BY_ID.has(v as DocumentType);
}

/** Interpreta `?docs=a,b,c` da impressão em lote, preservando a ordem do catálogo. */
export function parseDocSelection(raw: string | undefined): DocumentType[] {
  if (!raw) return [];
  const wanted = new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(isDocumentType),
  );
  return DOCUMENTS.filter((d) => wanted.has(d.id)).map((d) => d.id);
}
