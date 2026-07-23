/**
 * Modelos PUROS de anamnese por nicho (sem banco, sem "server-only"): as
 * perguntas iniciais que semeiam o questionário quando o paciente ainda não
 * tem anamnese. O profissional pode editar/adicionar/remover livremente.
 */

const COMUM = [
  "Queixa principal / motivo da consulta",
  "Histórico de doenças (pessoais)",
  "Histórico de doenças na família",
  "Medicamentos em uso",
  "Alergias",
  "Cirurgias anteriores",
];

const NUTRICIONISTA = [
  ...COMUM,
  "Rotina alimentar atual (dia típico)",
  "Consumo de água por dia",
  "Intolerâncias ou restrições alimentares",
  "Consumo de álcool / cafeína",
  "Prática de atividade física (tipo e frequência)",
  "Qualidade do sono",
  "Funcionamento intestinal",
  "Objetivo com o acompanhamento",
];

const PSICOLOGIA = [
  ...COMUM,
  "Demanda / o que traz à terapia",
  "Já fez acompanhamento psicológico antes?",
  "Uso de medicação psiquiátrica",
  "Rede de apoio (família, amigos)",
  "Situação de trabalho / estudo",
  "Qualidade do sono",
  "Uso de substâncias",
  "Expectativas com o acompanhamento",
];

const CLINICA = [
  ...COMUM,
  "Sintomas atuais (início e evolução)",
  "Hábitos (tabagismo, álcool, atividade física)",
  "Pressão arterial / condições cardíacas conhecidas",
  "Histórico de internações",
  "Vacinação em dia?",
  "Objetivo da consulta",
];

const TEMPLATES: Record<string, string[]> = {
  nutricionista: NUTRICIONISTA,
  psicologia: PSICOLOGIA,
  clinica: CLINICA,
};

/** Perguntas iniciais para o nicho (cai no comum se o nicho não tiver modelo). */
export function anamneseTemplate(niche: string | undefined): string[] {
  return (niche && TEMPLATES[niche]) || COMUM;
}
