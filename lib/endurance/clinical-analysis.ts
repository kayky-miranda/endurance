import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import { prisma } from "@/lib/db";
import { money } from "./money";
import { ageFromBirth } from "./patient";
import { parsePartialJson } from "./partial-json";
import { GEMINI_MODELS, isRetryableError } from "./gemini";
import { getPatientExams } from "./lab-exams";
import { EXAM_FLAG_LABEL } from "./lab-exam-rules";
import {
  isValidPriority,
  type ClinicalAnalysis,
  type AnalysisItem,
} from "./clinical-analysis-types";

/**
 * Assistente clínico: lê TODO o cadastro do paciente (anamnese, prontuário,
 * evolução, prescrições, agenda) e devolve uma análise estruturada de apoio à
 * consulta.
 *
 * DESEMPENHO — três decisões que definem a latência:
 *  1. `thinkingBudget: 0`. Nos modelos 2.5 o "pensamento" é ligado por padrão,
 *     conta no orçamento de saída e é o gargalo real: medido em ~2.4s com o
 *     raciocínio consumindo 380 dos 400 tokens e ESTOURANDO o limite
 *     (finishReason MAX_TOKENS) — era isso que cortava o resumo no meio da
 *     frase. Sem ele: ~1s e resposta completa. A tarefa é extração/organização
 *     de fatos, não raciocínio aberto; não perdemos qualidade.
 *  2. Uma única leva de consultas em paralelo, com `select` enxuto e limite de
 *     linhas — o modelo recebe só o que muda a análise.
 *  3. Saída estruturada (responseSchema), então a UI monta os cartões sem
 *     pós-processar texto livre.
 *
 * SEGURANÇA: o prompt proíbe inventar; cada item carrega `source` separando
 * FATO REGISTRADO de INFERÊNCIA; sem dados suficientes a própria análise se
 * declara insuficiente em vez de preencher com suposição.
 */

// Limites de contexto: o suficiente para a consulta, sem inflar o payload.
const MAX_NOTES = 8;
const MAX_NOTE_CHARS = 400;
const MAX_APPOINTMENTS = 8;
const MAX_PRESCRIPTIONS = 5;
const MAX_METRIC_POINTS = 3;
const MAX_EXAMS = 25;

export interface PatientContext {
  name: string;
  /** Texto compacto entregue ao modelo. */
  dossier: string;
  /** Quantos blocos de informação existem — base do "dados insuficientes". */
  signals: number;
}

const d = (x: Date) => x.toLocaleDateString("pt-BR");
const cut = (s: string, n: number) =>
  s.length > n ? `${s.slice(0, n)}…` : s;

/**
 * Monta o dossiê do paciente. TODAS as consultas saem juntas (Promise.all) —
 * são independentes entre si, então o custo é o da mais lenta, não a soma.
 */
export async function buildPatientContext(
  org: string,
  customerId: string,
  opts: { specialty?: string } = {},
): Promise<PatientContext | null> {
  const [customer, profile, anamnese, notes, metrics, appointments, prescriptions, exams] =
    await Promise.all([
      prisma.customer.findFirst({
        where: { id: customerId, organizationId: org },
        select: { id: true, name: true },
      }),
      prisma.patientProfile.findFirst({
        where: { organizationId: org, customerId },
        select: {
          birthDate: true,
          sex: true,
          profession: true,
          insuranceName: true,
          notes: true,
        },
      }),
      prisma.anamnese.findFirst({
        where: { organizationId: org, customerId },
        select: {
          status: true,
          updatedAt: true,
          items: {
            orderBy: { position: "asc" },
            select: { question: true, answer: true },
          },
        },
      }),
      prisma.clinicalNote.findMany({
        where: { organizationId: org, customerId },
        orderBy: { createdAt: "desc" },
        take: MAX_NOTES,
        select: {
          createdAt: true,
          title: true,
          content: true,
          cid: true,
          cidDescription: true,
        },
      }),
      prisma.patientMetric.findMany({
        where: { organizationId: org, customerId },
        orderBy: { measuredAt: "desc" },
        take: 40,
        select: { metric: true, label: true, value: true, unit: true, measuredAt: true },
      }),
      prisma.appointment.findMany({
        where: { organizationId: org, customerId },
        orderBy: { startsAt: "desc" },
        take: MAX_APPOINTMENTS,
        select: {
          startsAt: true,
          status: true,
          service: true,
          professional: true,
        },
      }),
      prisma.prescription.findMany({
        where: { organizationId: org, customerId },
        orderBy: { issuedAt: "desc" },
        take: MAX_PRESCRIPTIONS,
        select: {
          issuedAt: true,
          cid: true,
          cidDescription: true,
          instructions: true,
          items: {
            orderBy: { position: "asc" },
            select: { medication: true, dosage: true },
          },
        },
      }),
      getPatientExams(org, customerId, MAX_EXAMS),
    ]);

  if (!customer) return null;

  const blocks: string[] = [];
  let signals = 0;

  const age = ageFromBirth(profile?.birthDate ?? null);
  const ident = [
    age !== null ? `${age} anos` : "",
    profile?.sex || "",
    profile?.profession ? `profissão: ${profile.profession}` : "",
    profile?.insuranceName ? `convênio: ${profile.insuranceName}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  blocks.push(`# PACIENTE\n${customer.name}${ident ? ` — ${ident}` : ""}`);
  if (profile?.notes?.trim()) blocks.push(`# OBSERVAÇÕES DA FICHA\n${cut(profile.notes.trim(), 300)}`);

  const answered = (anamnese?.items ?? []).filter(
    (i) => i.question.trim() && i.answer.trim(),
  );
  if (answered.length > 0) {
    signals++;
    blocks.push(
      `# ANAMNESE (${anamnese?.status === "concluida" ? "concluída" : "rascunho"}, ${d(anamnese!.updatedAt)})\n` +
        answered.map((i) => `- ${i.question.trim()}: ${i.answer.trim()}`).join("\n"),
    );
  }

  if (notes.length > 0) {
    signals++;
    blocks.push(
      `# PRONTUÁRIO (${notes.length} anotações, mais recentes primeiro)\n` +
        notes
          .map(
            (n) =>
              `- [${d(n.createdAt)}${n.cid ? ` · CID ${n.cid}${n.cidDescription ? ` ${n.cidDescription}` : ""}` : ""}]` +
              `${n.title ? ` ${n.title}:` : ""} ${cut(n.content.trim(), MAX_NOTE_CHARS)}`,
          )
          .join("\n"),
    );
  }

  // Evolução: só as últimas medições de cada indicador (a tendência importa,
  // a série inteira não) — evita despejar dezenas de linhas no modelo.
  if (metrics.length > 0) {
    signals++;
    const byMetric = new Map<string, typeof metrics>();
    for (const m of metrics) {
      const list = byMetric.get(m.metric) ?? [];
      if (list.length < MAX_METRIC_POINTS) list.push(m);
      byMetric.set(m.metric, list);
    }
    blocks.push(
      `# EVOLUÇÃO (medições recentes)\n` +
        [...byMetric.values()]
          .map((list) => {
            const label = list[0].label || list[0].metric;
            const pts = list
              .map((m) => `${money(m.value)}${m.unit} (${d(m.measuredAt)})`)
              .join(" ← ");
            return `- ${label}: ${pts}`;
          })
          .join("\n"),
    );
  }

  // Exames: a situação (normal/alto/baixo) já vem CLASSIFICADA pela faixa de
  // referência do laudo. Entregamos pronta para a IA não ter que julgar se um
  // valor é anormal — isso é comparação, não opinião do modelo.
  if (exams.exams.length > 0) {
    signals++;
    blocks.push(
      `# EXAMES LABORATORIAIS (${exams.alteredCount} fora da referência)\n` +
        exams.exams
          .map(
            (e) =>
              `- [${d(new Date(e.collectedAt))}] ${e.name}: ${e.value}${e.unit}` +
              ` (ref. ${e.rangeLabel}) — ${EXAM_FLAG_LABEL[e.flag]}${e.severe ? ", desvio grande" : ""}` +
              (e.trend !== "primeiro" && e.delta !== 0
                ? `; anterior ${e.trend} ${e.delta > 0 ? "+" : ""}${e.delta}`
                : ""),
          )
          .join("\n"),
    );
  }

  if (prescriptions.length > 0) {
    signals++;
    blocks.push(
      `# PRESCRIÇÕES\n` +
        prescriptions
          .map((p) => {
            const meds = p.items
              .map((i) => `${i.medication}${i.dosage ? ` (${i.dosage})` : ""}`)
              .filter((s) => s.trim())
              .join("; ");
            return `- [${d(p.issuedAt)}${p.cid ? ` · CID ${p.cid}` : ""}] ${meds || "sem itens"}${p.instructions ? ` — ${cut(p.instructions, 160)}` : ""}`;
          })
          .join("\n"),
    );
  }

  if (appointments.length > 0) {
    signals++;
    blocks.push(
      `# ATENDIMENTOS\n` +
        appointments
          .map(
            (a) =>
              `- ${d(a.startsAt)} · ${a.status}${a.service ? ` · ${a.service}` : ""}${a.professional ? ` · ${a.professional}` : ""}`,
          )
          .join("\n"),
    );
  }

  if (opts.specialty) blocks.push(`# ESPECIALIDADE DO PROFISSIONAL\n${opts.specialty}`);

  return { name: customer.name, dossier: blocks.join("\n\n"), signals };
}

// ---------------------------------------------------------------------------

const itemSchema = {
  type: Type.OBJECT,
  properties: {
    text: { type: Type.STRING },
    source: { type: Type.STRING, enum: ["registro", "inferencia"] },
  },
  required: ["text", "source"],
};
const listOfItems = { type: Type.ARRAY, items: itemSchema };
const listOfStrings = { type: Type.ARRAY, items: { type: Type.STRING } };

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    resumo: { type: Type.STRING },
    queixaPrincipal: { type: Type.STRING },
    historico: listOfItems,
    fatoresRisco: listOfItems,
    alertas: listOfItems,
    medicamentos: listOfItems,
    alergias: listOfItems,
    doencasPrevias: listOfItems,
    habitos: listOfItems,
    inconsistencias: listOfItems,
    hipoteses: listOfItems,
    perguntasSugeridas: listOfStrings,
    examesSugeridos: listOfStrings,
    recomendacoes: listOfStrings,
    aInvestigar: listOfStrings,
    conclusao: { type: Type.STRING },
    prioridade: { type: Type.STRING, enum: ["baixa", "media", "alta"] },
    prioridadeMotivo: { type: Type.STRING },
    dadosInsuficientes: { type: Type.BOOLEAN },
  },
  required: [
    "resumo",
    "queixaPrincipal",
    "historico",
    "fatoresRisco",
    "alertas",
    "medicamentos",
    "alergias",
    "doencasPrevias",
    "habitos",
    "inconsistencias",
    "hipoteses",
    "perguntasSugeridas",
    "examesSugeridos",
    "recomendacoes",
    "aInvestigar",
    "conclusao",
    "prioridade",
    "prioridadeMotivo",
    "dadosInsuficientes",
  ],
};

const SYSTEM = `Você é um assistente de APOIO À DECISÃO para um profissional de saúde habilitado, preparando-o para a consulta.

A partir do DOSSIÊ do paciente, produza uma análise objetiva em português do Brasil.

REGRAS INEGOCIÁVEIS:
- Use EXCLUSIVAMENTE o que está no dossiê. NUNCA invente sintoma, medicamento, dose, diagnóstico, exame ou dado que não esteja escrito.
- Em cada item, marque "source": "registro" quando o fato está literalmente no dossiê; "inferencia" quando é leitura sua a partir dele.
- Se algo não foi informado, NÃO preencha por suposição: deixe a lista vazia e aponte o vazio em "aInvestigar".
- Se o dossiê tiver pouquíssimo conteúdo, marque "dadosInsuficientes": true, escreva isso no resumo e não force conclusões.
- "hipoteses" são possibilidades a considerar, NUNCA diagnóstico — escreva-as como hipóteses a investigar.
- Não prescreva. "examesSugeridos" e "recomendacoes" são opções para o profissional avaliar.

ESTILO: frases curtas e diretas, sem repetir o dossiê literalmente, sem enrolação. Cada lista com no máximo 6 itens, priorizando o que muda a conduta. "resumo" com 2 a 4 frases.

PRIORIDADE: "alta" para sinais de gravidade/urgência ou risco relevante; "media" para acompanhamento que não pode esperar; "baixa" para rotina. Justifique em "prioridadeMotivo".`;

/**
 * O que cada especialidade quer ver primeiro. Sem isto a análise sai genérica —
 * o nutricionista recebia os mesmos destaques do psicólogo. O foco entra no
 * prompt junto do dossiê e muda o que a IA prioriza em cada lista.
 */
const SPECIALTY_FOCUS: Record<string, string> = {
  nutricionista:
    "Priorize peso, IMC, circunferências e sua TENDÊNCIA ao longo do tempo, hábitos e rotina alimentar, hidratação, adesão ao plano e metas. Relacione as medições com o que o paciente relata.",
  psicologia:
    "Priorize humor, ansiedade, sono, eventos de vida, temas recorrentes entre as sessões, evolução terapêutica e adesão. Trate sintomas físicos como contexto, não como foco.",
  clinica:
    "Priorize doenças crônicas, controle pressórico e metabólico, medicação em uso e adesão, histórico familiar e risco cardiovascular.",
  academia:
    "Priorize objetivo do aluno, evolução de carga/medidas, frequência, limitações e dores relatadas, e risco de lesão.",
};

function specialtyBlock(niche: string | undefined): string {
  const focus = niche ? SPECIALTY_FOCUS[niche] : undefined;
  return focus ? `\n\nFOCO DA ESPECIALIDADE: ${focus}` : "";
}

export type AnalysisSource = "ai" | "unavailable";

/** Normaliza a saída do modelo — nunca confiamos cegamente no JSON recebido. */
function coerce(raw: unknown): ClinicalAnalysis | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  // Durante o streaming um item pode chegar com o texto pronto mas ainda sem o
  // `source`. Descartamos esses: assumir um padrão marcaria uma INFERÊNCIA como
  // FATO REGISTRADO (ou o contrário) por uma fração de segundo — e essa
  // distinção é justamente a garantia de segurança da análise. Some no chunk
  // seguinte, já com o campo correto.
  const items = (v: unknown): AnalysisItem[] =>
    Array.isArray(v)
      ? v
          .map((x) => {
            const i = (x ?? {}) as Record<string, unknown>;
            const text = String(i.text ?? "").trim();
            const valid = i.source === "registro" || i.source === "inferencia";
            return text && valid
              ? { text: text.slice(0, 400), source: i.source as AnalysisItem["source"] }
              : null;
          })
          .filter((x): x is AnalysisItem => x !== null)
          .slice(0, 6)
      : [];

  const strings = (v: unknown): string[] =>
    Array.isArray(v)
      ? v
          .map((x) => String(x ?? "").trim().slice(0, 300))
          .filter(Boolean)
          .slice(0, 6)
      : [];

  const resumo = String(o.resumo ?? "").trim();
  if (!resumo) return null;

  return {
    resumo: resumo.slice(0, 1200),
    queixaPrincipal: String(o.queixaPrincipal ?? "").trim().slice(0, 400),
    historico: items(o.historico),
    fatoresRisco: items(o.fatoresRisco),
    alertas: items(o.alertas),
    medicamentos: items(o.medicamentos),
    alergias: items(o.alergias),
    doencasPrevias: items(o.doencasPrevias),
    habitos: items(o.habitos),
    inconsistencias: items(o.inconsistencias),
    hipoteses: items(o.hipoteses),
    perguntasSugeridas: strings(o.perguntasSugeridas),
    examesSugeridos: strings(o.examesSugeridos),
    recomendacoes: strings(o.recomendacoes),
    aInvestigar: strings(o.aInvestigar),
    conclusao: String(o.conclusao ?? "").trim().slice(0, 800),
    prioridade: isValidPriority(o.prioridade) ? o.prioridade : "baixa",
    prioridadeMotivo: String(o.prioridadeMotivo ?? "").trim().slice(0, 300),
    dadosInsuficientes: Boolean(o.dadosInsuficientes),
  };
}

const GEN_CONFIG = {
  responseMimeType: "application/json" as const,
  responseSchema: RESPONSE_SCHEMA,
  temperature: 0.2,
  maxOutputTokens: 2400,
  // Ver o comentário do topo: o "pensamento" é o gargalo e ainda estourava o
  // orçamento de saída, truncando a resposta no meio da frase.
  thinkingConfig: { thinkingBudget: 0 },
};

/**
 * Versão em STREAMING: entrega a análise parcial a cada pedaço recebido, para a
 * tela preencher os cartões enquanto o modelo ainda escreve. É o que derruba a
 * espera percebida — o primeiro conteúdo aparece em torno de 0,7s, em vez de
 * uma tela parada até a resposta inteira ficar pronta.
 *
 * Cada `yield` já vem normalizado por `coerce`, então o consumidor nunca vê
 * texto cortado nem item sem procedência.
 */
export async function* streamPatientAnalysis(
  ctx: PatientContext,
  opts: { signal?: AbortSignal; niche?: string } = {},
): AsyncGenerator<{ analysis: ClinicalAnalysis; done: boolean }> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return;

  const ai = new GoogleGenAI({ apiKey });
  let lastError: unknown = null;
  for (const model of GEMINI_MODELS) {
    if (opts.signal?.aborted) return;
    try {
      const stream = await ai.models.generateContentStream({
        model,
        contents: ctx.dossier,
        config: {
          systemInstruction: SYSTEM + specialtyBlock(opts.niche),
          ...GEN_CONFIG,
          ...(opts.signal ? { abortSignal: opts.signal } : {}),
        },
      });

      let buffer = "";
      let lastJson = "";
      for await (const chunk of stream) {
        if (opts.signal?.aborted) return;
        const piece = chunk.text ?? "";
        if (!piece) continue;
        buffer += piece;
        const partial = coerce(parsePartialJson(buffer));
        if (!partial) continue;
        // Só emite quando algo REALMENTE mudou — evita re-render à toa.
        const snapshot = JSON.stringify(partial);
        if (snapshot === lastJson) continue;
        lastJson = snapshot;
        yield { analysis: partial, done: false };
      }

      const final = coerce(parsePartialJson(buffer));
      if (final) yield { analysis: final, done: true };
      return;
    } catch (e) {
      if (opts.signal?.aborted) return;
      lastError = e;
      if (isRetryableError(e)) continue;
      console.error("[clinical-analysis] streaming falhou:", e);
      throw e;
    }
  }
  // Todos os modelos falharam de forma recuperável (tipicamente cota).
  if (lastError) throw lastError;
}

/**
 * Gera a análise. Sem chave de IA devolve "unavailable" — em contexto clínico
 * NÃO existe fallback heurístico: uma análise fabricada localmente seria pior
 * do que nenhuma.
 */
export async function analyzePatient(
  ctx: PatientContext,
  opts: { signal?: AbortSignal; niche?: string } = {},
): Promise<{ analysis: ClinicalAnalysis | null; source: AnalysisSource }> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return { analysis: null, source: "unavailable" };

  try {
    const ai = new GoogleGenAI({ apiKey });
    for (const model of GEMINI_MODELS) {
      if (opts.signal?.aborted) return { analysis: null, source: "unavailable" };
      try {
        const resp = await ai.models.generateContent({
          model,
          contents: ctx.dossier,
          config: {
            systemInstruction: SYSTEM + specialtyBlock(opts.niche),
            ...GEN_CONFIG,
            ...(opts.signal ? { abortSignal: opts.signal } : {}),
          },
        });
        const parsed = coerce(resp.text ? JSON.parse(resp.text) : null);
        if (parsed) return { analysis: parsed, source: "ai" };
        break;
      } catch (e) {
        if (isRetryableError(e)) continue;
        throw e;
      }
    }
  } catch (err) {
    console.error("[clinical-analysis] falhou:", err);
  }
  return { analysis: null, source: "unavailable" };
}
