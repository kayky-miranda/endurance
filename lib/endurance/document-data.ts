import "server-only";
import { prisma } from "@/lib/db";
import { getPatient, type PatientDetail } from "./pacientes";
import { getPatientExams, type LabExamRow } from "./lab-exams";
import { getPatientBriefing, type MetricTrend } from "./patient-briefing";
import type { DocumentType } from "./document-catalog";

/**
 * Dados de cada documento imprimível. Uma função por tipo, todas devolvendo um
 * payload discriminado por `type` — assim o renderizador é uma troca exaustiva
 * e o compilador cobra quando um documento novo entra no catálogo.
 *
 * Só carrega o que o documento imprime: nada de reaproveitar uma consulta
 * pesada "porque já existe".
 */

export interface PatientLite {
  name: string;
  birthDate: string | null;
  cpf: string;
  insuranceName: string;
}

export type DocumentPayload =
  | {
      type: "declaracao-comparecimento";
      patient: PatientLite;
      visit: {
        startsAt: string;
        startTime: string;
        endTime: string;
        professional: string;
      } | null;
    }
  | {
      type: "solicitacao-exames";
      patient: PatientLite;
      hypothesis: string;
    }
  | {
      type: "anamnese";
      patient: PatientLite;
      status: string;
      items: { question: string; answer: string }[];
    }
  | {
      type: "prontuario";
      patient: PatientLite;
      notes: {
        createdAt: string;
        title: string;
        content: string;
        cid: string;
        cidDescription: string;
        authorName: string;
      }[];
    }
  | { type: "evolucao"; patient: PatientLite; trends: MetricTrend[] }
  | { type: "resultados-exames"; patient: PatientLite; exams: LabExamRow[] }
  | {
      type: "historico-consultas";
      patient: PatientLite;
      appointments: {
        startsAt: string;
        service: string;
        professional: string;
        status: string;
      }[];
    }
  | { type: "ficha-cadastral"; detail: PatientDetail };

const hhmm = (d: Date) =>
  d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

async function patientLite(org: string, customerId: string): Promise<PatientLite | null> {
  const [customer, profile] = await Promise.all([
    prisma.customer.findFirst({
      where: { id: customerId, organizationId: org },
      select: { name: true, document: true },
    }),
    prisma.patientProfile.findFirst({
      where: { organizationId: org, customerId },
      select: { birthDate: true, insuranceName: true },
    }),
  ]);
  if (!customer) return null;
  return {
    name: customer.name,
    cpf: customer.document ?? "",
    birthDate: profile?.birthDate ? profile.birthDate.toISOString() : null,
    insuranceName: profile?.insuranceName ?? "",
  };
}

/**
 * Monta o payload do documento. Devolve `null` quando o paciente não existe na
 * organização — o chamador transforma em 404, sem vazar existência entre orgs.
 */
export async function buildDocument(
  org: string,
  type: DocumentType,
  customerId: string,
): Promise<DocumentPayload | null> {
  if (type === "ficha-cadastral") {
    const detail = await getPatient(org, customerId);
    return detail ? { type, detail } : null;
  }

  const patient = await patientLite(org, customerId);
  if (!patient) return null;

  switch (type) {
    case "declaracao-comparecimento": {
      // O atendimento mais recente já concluído é o que se declara.
      const a = await prisma.appointment.findFirst({
        where: { organizationId: org, customerId, status: "atendido" },
        orderBy: { startsAt: "desc" },
        select: { startsAt: true, durationMin: true, professional: true },
      });
      return {
        type,
        patient,
        visit: a
          ? {
              startsAt: a.startsAt.toISOString(),
              startTime: hhmm(a.startsAt),
              endTime: hhmm(new Date(a.startsAt.getTime() + a.durationMin * 60_000)),
              professional: a.professional,
            }
          : null,
      };
    }

    case "solicitacao-exames": {
      // Indicação sugerida: o CID da anotação mais recente, quando houver.
      const note = await prisma.clinicalNote.findFirst({
        where: { organizationId: org, customerId, cid: { not: "" } },
        orderBy: { createdAt: "desc" },
        select: { cid: true, cidDescription: true },
      });
      return {
        type,
        patient,
        hypothesis: note
          ? `${note.cid}${note.cidDescription ? ` — ${note.cidDescription}` : ""}`
          : "",
      };
    }

    case "anamnese": {
      const a = await prisma.anamnese.findFirst({
        where: { organizationId: org, customerId },
        select: {
          status: true,
          items: { orderBy: { position: "asc" }, select: { question: true, answer: true } },
        },
      });
      return {
        type,
        patient,
        status: a?.status === "concluida" ? "concluída" : a ? "rascunho" : "",
        items: a?.items ?? [],
      };
    }

    case "prontuario": {
      const notes = await prisma.clinicalNote.findMany({
        where: { organizationId: org, customerId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          createdAt: true,
          title: true,
          content: true,
          cid: true,
          cidDescription: true,
          authorName: true,
        },
      });
      return {
        type,
        patient,
        notes: notes.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
      };
    }

    case "evolucao": {
      const b = await getPatientBriefing(org, customerId);
      return { type, patient, trends: b?.trends ?? [] };
    }

    case "resultados-exames": {
      const v = await getPatientExams(org, customerId, 80);
      return { type, patient, exams: v.exams };
    }

    case "historico-consultas": {
      const rows = await prisma.appointment.findMany({
        where: { organizationId: org, customerId },
        orderBy: { startsAt: "desc" },
        take: 100,
        select: { startsAt: true, service: true, professional: true, status: true },
      });
      return {
        type,
        patient,
        appointments: rows.map((a) => ({
          ...a,
          startsAt: a.startsAt.toISOString(),
        })),
      };
    }
  }
}
