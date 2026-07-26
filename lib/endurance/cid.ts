/**
 * Catálogo CID-10 CURADO (subconjunto dos códigos mais usados na atenção
 * primária/consultório) + busca pura. Não é a CID-10 completa (~14 mil códigos):
 * é um ponto de partida pesquisável; a entrada livre (código + descrição) cobre
 * o que faltar. Estrutura pronta para plugar a tabela oficial completa depois.
 *
 * Módulo PURO (sem banco, sem "server-only") — usado no cliente e no servidor.
 */

export interface CidCode {
  code: string;
  description: string;
}

export const CID10_CATALOG: CidCode[] = [
  // Infecciosas
  { code: "A09", description: "Diarreia e gastroenterite de origem infecciosa presumível" },
  { code: "A90", description: "Dengue clássico" },
  { code: "B34.2", description: "Infecção por coronavírus de localização não especificada" },
  { code: "B01", description: "Varicela" },
  { code: "B02", description: "Herpes-zóster" },
  // Neoplasias
  { code: "C50", description: "Neoplasia maligna da mama" },
  { code: "D22", description: "Nevo melanocítico" },
  // Sangue
  { code: "D50", description: "Anemia por deficiência de ferro" },
  { code: "D64", description: "Outras anemias" },
  // Endócrinas / metabólicas
  { code: "E03", description: "Hipotireoidismo" },
  { code: "E05", description: "Tireotoxicose (hipertireoidismo)" },
  { code: "E10", description: "Diabetes mellitus tipo 1" },
  { code: "E11", description: "Diabetes mellitus tipo 2" },
  { code: "E66", description: "Obesidade" },
  { code: "E78", description: "Distúrbios do metabolismo de lipoproteínas (dislipidemia)" },
  { code: "E86", description: "Depleção de volume (desidratação)" },
  // Transtornos mentais
  { code: "F32", description: "Episódio depressivo" },
  { code: "F33", description: "Transtorno depressivo recorrente" },
  { code: "F41", description: "Outros transtornos ansiosos" },
  { code: "F41.0", description: "Transtorno de pânico" },
  { code: "F41.1", description: "Ansiedade generalizada" },
  { code: "F43", description: "Reações ao stress grave e transtornos de adaptação" },
  { code: "F50", description: "Transtornos da alimentação" },
  { code: "F90", description: "Transtornos hipercinéticos (TDAH)" },
  // Neurológicas
  { code: "G43", description: "Enxaqueca" },
  { code: "G44", description: "Outras síndromes de algias cefálicas" },
  { code: "G47", description: "Distúrbios do sono" },
  // Olhos / ouvidos
  { code: "H10", description: "Conjuntivite" },
  { code: "H66", description: "Otite média supurativa" },
  // Circulatórias
  { code: "I10", description: "Hipertensão essencial (primária)" },
  { code: "I20", description: "Angina pectoris" },
  { code: "I25", description: "Doença isquêmica crônica do coração" },
  { code: "I48", description: "Fibrilação e flutter atrial" },
  { code: "I83", description: "Varizes dos membros inferiores" },
  // Respiratórias
  { code: "J00", description: "Nasofaringite aguda (resfriado comum)" },
  { code: "J02", description: "Faringite aguda" },
  { code: "J03", description: "Amigdalite aguda" },
  { code: "J06", description: "Infecção aguda das vias aéreas superiores" },
  { code: "J11", description: "Influenza (gripe)" },
  { code: "J20", description: "Bronquite aguda" },
  { code: "J45", description: "Asma" },
  { code: "J44", description: "Doença pulmonar obstrutiva crônica (DPOC)" },
  // Digestivas
  { code: "K21", description: "Doença de refluxo gastroesofágico" },
  { code: "K29", description: "Gastrite e duodenite" },
  { code: "K30", description: "Dispepsia funcional" },
  { code: "K52", description: "Outras gastroenterites e colites não infecciosas" },
  { code: "K58", description: "Síndrome do intestino irritável" },
  { code: "K59", description: "Outros transtornos funcionais do intestino (constipação)" },
  // Pele
  { code: "L20", description: "Dermatite atópica" },
  { code: "L23", description: "Dermatite alérgica de contato" },
  { code: "L30", description: "Outras dermatites" },
  { code: "L70", description: "Acne" },
  // Musculoesqueléticas
  { code: "M25.5", description: "Dor articular" },
  { code: "M54", description: "Dorsalgia" },
  { code: "M54.5", description: "Dor lombar baixa (lombalgia)" },
  { code: "M79.1", description: "Mialgia" },
  { code: "M75", description: "Lesões do ombro" },
  // Geniturinárias
  { code: "N39.0", description: "Infecção do trato urinário de localização não especificada" },
  { code: "N76", description: "Outras afecções inflamatórias da vagina e da vulva" },
  // Gravidez
  { code: "Z34", description: "Supervisão de gravidez normal" },
  // Sintomas / sinais
  { code: "R05", description: "Tosse" },
  { code: "R10", description: "Dor abdominal e pélvica" },
  { code: "R42", description: "Tontura e instabilidade" },
  { code: "R50", description: "Febre de origem desconhecida" },
  { code: "R51", description: "Cefaleia" },
  { code: "R53", description: "Mal-estar e fadiga" },
  // Exames / fatores
  { code: "Z00", description: "Exame médico geral" },
  { code: "Z01", description: "Outros exames especiais" },
  { code: "Z71", description: "Aconselhamento e orientação médica" },
  { code: "Z76", description: "Retorno para acompanhamento" },
  // Nutrição
  { code: "E43", description: "Desnutrição proteico-calórica grave" },
  { code: "E44", description: "Desnutrição proteico-calórica moderada e leve" },
  { code: "E46", description: "Desnutrição proteico-calórica não especificada" },
  { code: "R63.4", description: "Perda de peso anormal" },
  { code: "R63.5", description: "Ganho de peso anormal" },
];

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** Busca por código (prefixo) ou descrição (substring), sem acento. */
export function searchCid(term: string, limit = 12): CidCode[] {
  const q = norm(term);
  if (q.length < 2) return [];
  const byCode: CidCode[] = [];
  const byDesc: CidCode[] = [];
  for (const c of CID10_CATALOG) {
    const code = norm(c.code);
    if (code.startsWith(q) || c.code.toLowerCase().replace(".", "").startsWith(q.replace(".", "")))
      byCode.push(c);
    else if (norm(c.description).includes(q)) byDesc.push(c);
  }
  return [...byCode, ...byDesc].slice(0, limit);
}

/** Valida um código informado livremente contra o catálogo (para autocompletar). */
export function findCid(code: string): CidCode | undefined {
  const c = norm(code);
  return CID10_CATALOG.find((x) => norm(x.code) === c);
}
