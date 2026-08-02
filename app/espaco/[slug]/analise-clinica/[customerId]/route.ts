import { getSession, sessionHasPermission } from "@/lib/auth";
import { hit } from "@/lib/rate-limit";
import { getWorkspace } from "@/lib/endurance/workspace";
import { logActivity } from "@/lib/endurance/activity-log";
import {
  buildPatientContext,
  streamPatientAnalysis,
} from "@/lib/endurance/clinical-analysis";
import { isQuotaError } from "@/lib/endurance/gemini";
import type { ClinicalAnalysis } from "@/lib/endurance/clinical-analysis-types";
import {
  computeFingerprint,
  readAnalysisCache,
  writeAnalysisCache,
} from "@/lib/endurance/analysis-cache";

/**
 * Análise clínica assistida, em STREAMING (NDJSON — um evento por linha).
 *
 * Por que uma rota e não uma server action: server action só responde de uma
 * vez, o que devolveria a tela parada até o fim. Aqui cada etapa e cada versão
 * parcial da análise saem assim que existem, e o cliente pode CANCELAR
 * abortando a requisição — o `request.signal` interrompe a chamada à IA de
 * verdade, sem deixar geração órfã rodando (e sendo cobrada).
 *
 * Eventos:
 *   {"type":"stage","stage":"...","label":"..."}
 *   {"type":"partial","analysis":{...}}
 *   {"type":"done","analysis":{...}}
 *   {"type":"error","error":"..."}
 */

export const dynamic = "force-dynamic";

const line = (o: unknown) => `${JSON.stringify(o)}\n`;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; customerId: string }> },
) {
  const { slug, customerId } = await params;

  const session = await getSession();
  if (!session || session.slug !== slug)
    return new Response("Não autorizado.", { status: 401 });
  // Análise sobre dado clínico: mesma permissão do prontuário.
  if (!sessionHasPermission(session, "prontuario.manage"))
    return new Response("Acesso restrito.", { status: 403 });
  if (!(await hit(`clinical:analysis:${session.sub}`, 10, 60_000)).ok)
    return new Response("Muitas análises seguidas. Aguarde um instante.", {
      status: 429,
    });

  // "Refazer análise" ignora o cache de propósito — o profissional quer uma
  // leitura nova, ainda que os dados não tenham mudado.
  const force = new URL(request.url).searchParams.get("refazer") === "1";

  const encoder = new TextEncoder();
  const signal = request.signal;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (o: unknown) => {
        if (signal.aborted) return;
        controller.enqueue(encoder.encode(line(o)));
      };

      try {
        send({ type: "stage", stage: "coletando", label: "Lendo o cadastro do paciente" });

        // As duas leituras são independentes — vão juntas.
        const [ws, ctxEarly] = await Promise.all([
          getWorkspace(slug),
          buildPatientContext(session.org, customerId),
        ]);

        if (!ctxEarly) {
          send({ type: "error", error: "Paciente não encontrado." });
          controller.close();
          return;
        }
        if (signal.aborted) return controller.close();

        // A especialidade entra no dossiê (contexto) e também no prompt, que
        // muda o QUE a IA prioriza — nutricionista e psicólogo não devem
        // receber os mesmos destaques.
        const ctx = ws?.nicheLabel
          ? {
              ...ctxEarly,
              dossier: `${ctxEarly.dossier}\n\n# ESPECIALIDADE DO PROFISSIONAL\n${ws.nicheLabel}`,
            }
          : ctxEarly;

        // CACHE: se nada mudou no cadastro desde a última análise, devolvemos a
        // guardada — resposta instantânea, sem pagar tempo nem cota do modelo.
        const niche = ws?.niche ?? "";
        const fingerprint = await computeFingerprint(session.org, customerId);
        const cached = await readAnalysisCache(
          session.org,
          customerId,
          fingerprint,
          niche,
        );
        if (cached && !force) {
          send({
            type: "done",
            analysis: cached.analysis,
            cachedAt: cached.createdAt.toISOString(),
          });
          controller.close();
          return;
        }

        if (ctx.signals === 0) {
          send({
            type: "error",
            error:
              "Este paciente ainda não tem anamnese, prontuário, evolução ou histórico para analisar.",
          });
          controller.close();
          return;
        }

        send({
          type: "stage",
          stage: "analisando",
          label: "Analisando histórico e prontuário",
        });

        let last: unknown = null;
        let sawContent = false;
        try {
          for await (const ev of streamPatientAnalysis(ctx, {
            signal,
            niche: ws?.niche,
          })) {
            if (signal.aborted) break;
            if (!sawContent) {
              sawContent = true;
              send({
                type: "stage",
                stage: "gerando",
                label: "Gerando alertas e recomendações",
              });
            }
            last = ev.analysis;
            send({ type: ev.done ? "done" : "partial", analysis: ev.analysis });
          }
        } catch (e) {
          // Cota da chave de IA é o erro mais comum na prática — merece uma
          // mensagem que diga o que fazer, não um "falhou" genérico.
          send({
            type: "error",
            error: isQuotaError(e)
              ? "O limite de uso da chave de IA foi atingido. Tente novamente em alguns minutos."
              : "Não foi possível concluir a análise. Tente novamente.",
          });
          controller.close();
          return;
        }

        if (!signal.aborted && !last) {
          send({
            type: "error",
            error:
              "A análise com IA não está disponível (configure a chave GEMINI_API_KEY).",
          });
        } else if (!signal.aborted) {
          // Guarda para as próximas aberturas e registra o ACESSO na auditoria
          // (nunca o conteúdo clínico).
          await Promise.all([
            writeAnalysisCache(
              session.org,
              customerId,
              fingerprint,
              niche,
              last as ClinicalAnalysis,
            ),
            logActivity(
              session,
              "prontuario.analysis",
              "Gerou análise clínica assistida por IA",
              customerId,
            ),
          ]);
        }
      } catch (err) {
        console.error("[analise-clinica] falhou:", err);
        if (!signal.aborted)
          send({ type: "error", error: "Falha ao gerar a análise." });
      } finally {
        try {
          controller.close();
        } catch {
          // já fechado pelo cancelamento do cliente
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no", // impede buffer intermediário que mataria o streaming
    },
  });
}
