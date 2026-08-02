import "server-only";
import { prisma } from "@/lib/db";
import type { ClinicalAnalysis } from "./clinical-analysis-types";

/**
 * Cache da análise clínica.
 *
 * Gerar a análise custa segundos e cota do modelo. Na prática o profissional
 * abre a mesma ficha várias vezes (antes, durante e depois da consulta) e vários
 * profissionais podem abrir o mesmo paciente — sem cache, cada abertura paga o
 * custo inteiro de novo, para produzir o mesmo texto.
 *
 * A invalidação é por IMPRESSÃO DIGITAL dos dados: contagens + instante da
 * última alteração de cada fonte que entra no dossiê. Se nada mudou no cadastro,
 * a análise anterior continua válida e a tela abre instantânea; qualquer
 * anotação, medição, prescrição ou consulta nova muda o fingerprint e força uma
 * geração fresca. É o oposto de um cache por tempo, que devolveria análise
 * desatualizada logo depois de o profissional registrar algo.
 *
 * O `niche` entra na chave porque muda o foco do prompt — e portanto o resultado.
 */

export interface CachedAnalysis {
  analysis: ClinicalAnalysis;
  createdAt: Date;
}

/**
 * Impressão digital do estado dos dados do paciente. Usa agregações (count +
 * max de data), que o banco resolve pelos índices — bem mais barato do que
 * reler o conteúdo para comparar.
 */
export async function computeFingerprint(
  org: string,
  customerId: string,
): Promise<string> {
  const where = { organizationId: org, customerId };
  const [notes, metrics, appointments, prescriptions, attachments, anamnese, profile] =
    await Promise.all([
      prisma.clinicalNote.aggregate({ where, _count: { _all: true }, _max: { updatedAt: true } }),
      prisma.patientMetric.aggregate({ where, _count: { _all: true }, _max: { measuredAt: true } }),
      prisma.appointment.aggregate({ where, _count: { _all: true }, _max: { updatedAt: true } }),
      prisma.prescription.aggregate({ where, _count: { _all: true }, _max: { issuedAt: true } }),
      prisma.patientAttachment.aggregate({ where, _count: { _all: true }, _max: { createdAt: true } }),
      prisma.anamnese.findFirst({ where, select: { updatedAt: true, status: true } }),
      prisma.patientProfile.findFirst({ where, select: { updatedAt: true } }),
    ]);

  const t = (d: Date | null | undefined) => (d ? d.getTime() : 0);
  return [
    `n${notes._count._all}:${t(notes._max.updatedAt)}`,
    `m${metrics._count._all}:${t(metrics._max.measuredAt)}`,
    `a${appointments._count._all}:${t(appointments._max.updatedAt)}`,
    `p${prescriptions._count._all}:${t(prescriptions._max.issuedAt)}`,
    `x${attachments._count._all}:${t(attachments._max.createdAt)}`,
    `q${t(anamnese?.updatedAt)}:${anamnese?.status ?? "-"}`,
    `f${t(profile?.updatedAt)}`,
  ].join("|");
}

/** Análise válida para o estado ATUAL dos dados, ou null. */
export async function readAnalysisCache(
  org: string,
  customerId: string,
  fingerprint: string,
  niche: string,
): Promise<CachedAnalysis | null> {
  const row = await prisma.clinicalAnalysisCache.findFirst({
    where: { organizationId: org, customerId, fingerprint, niche },
    select: { payload: true, createdAt: true },
  });
  if (!row) return null;
  try {
    return { analysis: JSON.parse(row.payload) as ClinicalAnalysis, createdAt: row.createdAt };
  } catch {
    // Payload corrompido não pode derrubar a análise: trata como "sem cache".
    return null;
  }
}

/**
 * Guarda a análise. Uma linha por paciente (@@unique org+customer): a versão
 * nova substitui a antiga, então o cache não cresce sem limite.
 */
export async function writeAnalysisCache(
  org: string,
  customerId: string,
  fingerprint: string,
  niche: string,
  analysis: ClinicalAnalysis,
): Promise<void> {
  const payload = JSON.stringify(analysis);
  try {
    await prisma.clinicalAnalysisCache.upsert({
      where: { organizationId_customerId: { organizationId: org, customerId } },
      create: { organizationId: org, customerId, fingerprint, niche, payload },
      update: { fingerprint, niche, payload, createdAt: new Date() },
    });
  } catch (err) {
    // Falhar ao GUARDAR não pode quebrar a análise já entregue ao profissional.
    console.error("[analysis-cache] falha ao gravar:", err);
  }
}
