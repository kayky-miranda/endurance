/**
 * Catálogo dos recursos de IA — PURO e fonte ÚNICA.
 *
 * Antes o conceito "recurso de IA" existia em dois lugares com listas
 * divergentes: a telemetria conhecia 7 recursos, os créditos conheciam 13, e
 * nenhum dos dois via a lista do outro. Um recurso podia ser cobrado sem ser
 * medido — exatamente o que aconteceu com os recursos clínicos.
 *
 * Aqui os dois conjuntos convivem explicitamente: tudo que chama o modelo é
 * MEDIDO; um subconjunto é COBRADO.
 */

/** Recursos que consomem crédito do plano. */
export const BILLED_AI_FEATURES = [
  "clinical_analysis",
  "clinical_evolution",
  "clinical_summary",
  "clinical_suggestions",
  "anamnese_summary",
  "text_proofread",
  "assistant",
  "sales_insights",
  "clinic_insights",
  "stock_advice",
  "pricing_advice",
  "crosssell",
  "crm_campaigns",
] as const;

export type BilledAiFeature = (typeof BILLED_AI_FEATURES)[number];

/**
 * Recursos que NÃO consomem crédito, mas são medidos.
 *
 * `onboarding` roda durante o cadastro, antes de a empresa existir — cobrar ali
 * bloquearia a entrada de um cliente novo. `marketing_carousel` tem créditos
 * próprios, na assinatura de marketing.
 */
export const UNBILLED_AI_FEATURES = ["onboarding", "marketing_carousel"] as const;

export type UnbilledAiFeature = (typeof UNBILLED_AI_FEATURES)[number];

/** Tudo que chama o modelo — é o universo da telemetria. */
export type AiFeatureId = BilledAiFeature | UnbilledAiFeature;

export const ALL_AI_FEATURES: AiFeatureId[] = [
  ...BILLED_AI_FEATURES,
  ...UNBILLED_AI_FEATURES,
];

/**
 * Custo em créditos, proporcional ao trabalho REAL do modelo (calibrado pela
 * telemetria): o que gera texto longo e estruturado custa mais que o que
 * devolve três frases.
 */
export const AI_FEATURE_COST: Record<BilledAiFeature, number> = {
  clinical_analysis: 3, // ~1.200 tokens de saída estruturada, o mais pesado
  assistant: 2, // contexto grande (~2.900 tokens de entrada) e multi-turno
  clinical_evolution: 1,
  clinical_summary: 1,
  clinical_suggestions: 1,
  anamnese_summary: 1,
  text_proofread: 1,
  sales_insights: 1,
  clinic_insights: 1,
  stock_advice: 1,
  pricing_advice: 1,
  crosssell: 1,
  crm_campaigns: 1,
};

const BILLED = new Set<string>(BILLED_AI_FEATURES);

export function isBilledAiFeature(id: string): id is BilledAiFeature {
  return BILLED.has(id);
}

/** Rótulos para o extrato de consumo. */
export const AI_FEATURE_LABEL: Record<AiFeatureId, string> = {
  clinical_analysis: "Análise clínica",
  clinical_evolution: "Redação de evolução",
  clinical_summary: "Resumo do prontuário",
  clinical_suggestions: "Sugestão de conduta",
  anamnese_summary: "Resumo da anamnese",
  text_proofread: "Correção de texto",
  assistant: "Assistente",
  sales_insights: "Insights de vendas",
  clinic_insights: "Insights da clínica",
  stock_advice: "Recomendação de estoque",
  pricing_advice: "Sugestão de preço",
  crosssell: "Sugestão no caixa",
  crm_campaigns: "Campanhas de CRM",
  onboarding: "Identificação do negócio",
  marketing_carousel: "Carrossel de marketing",
};
