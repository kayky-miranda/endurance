"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Loader2,
  X,
  RefreshCw,
  AlertTriangle,
  ShieldAlert,
  Pill,
  Activity,
  HeartPulse,
  HelpCircle,
  FlaskConical,
  ListChecks,
  Stethoscope,
  ClipboardCheck,
  FileWarning,
  Info,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  AI_DISCLAIMER,
  PRIORITY_LABEL,
  type AnalysisItem,
  type ClinicalAnalysis,
  type Priority,
} from "@/lib/endurance/clinical-analysis-types";

/**
 * Análise clínica assistida — consome o NDJSON da rota de streaming e vai
 * preenchendo os cartões conforme o texto chega, para a tela nunca ficar parada.
 * O `AbortController` cancela de verdade (interrompe a geração no servidor).
 */

const PRIORITY_STYLE: Record<Priority, string> = {
  alta: "bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/30",
  media: "bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30",
  baixa: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
};

type Phase = "idle" | "running" | "done" | "error" | "cancelled";

export default function ClinicalAnalysisPanel({
  slug,
  customerId,
}: {
  slug: string;
  customerId: string;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [stage, setStage] = useState("");
  const [analysis, setAnalysis] = useState<ClinicalAnalysis | null>(null);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  // Se o usuário sair da tela no meio, não deixamos a geração rodando.
  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setPhase("running");
    setError("");
    setAnalysis(null);
    setStage("Iniciando análise");

    try {
      const res = await fetch(`/espaco/${slug}/analise-clinica/${customerId}`, {
        method: "POST",
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        setError(
          res.status === 429
            ? "Muitas análises seguidas. Aguarde um instante."
            : await res.text().catch(() => "Falha ao gerar a análise."),
        );
        setPhase("error");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // NDJSON: processa as linhas completas e guarda o resto.
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const raw of lines) {
          if (!raw.trim()) continue;
          let ev: Record<string, unknown>;
          try {
            ev = JSON.parse(raw);
          } catch {
            continue;
          }
          if (ev.type === "stage") setStage(String(ev.label ?? ""));
          else if (ev.type === "partial" || ev.type === "done") {
            setAnalysis(ev.analysis as ClinicalAnalysis);
            if (ev.type === "done") setPhase("done");
          } else if (ev.type === "error") {
            setError(String(ev.error ?? "Falha ao gerar a análise."));
            setPhase("error");
          }
        }
      }
      setPhase((p) => (p === "running" ? "done" : p));
    } catch (e) {
      if ((e as Error).name === "AbortError") return; // cancelamento é esperado
      setError("Falha de conexão ao gerar a análise.");
      setPhase("error");
    }
  }, [slug, customerId]);

  function cancel() {
    abortRef.current?.abort();
    setPhase("cancelled");
    setStage("");
  }

  const running = phase === "running";

  return (
    <section className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-600 dark:text-brand-300">
          <Sparkles className="h-4 w-4" /> Análise clínica com IA
          {analysis && !running && (
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${PRIORITY_STYLE[analysis.prioridade]}`}
            >
              Prioridade {PRIORITY_LABEL[analysis.prioridade]}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {running ? (
            <button
              onClick={cancel}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-rose-400 hover:text-rose-500 dark:border-ink-600 dark:text-slate-300"
            >
              <X className="h-3.5 w-3.5" /> Cancelar
            </button>
          ) : (
            <button
              onClick={run}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-ink-950 transition hover:bg-brand-400"
            >
              {phase === "idle" ? (
                <>
                  <Sparkles className="h-3.5 w-3.5" /> Analisar paciente
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" /> Refazer análise
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Progresso: etapa atual + barra indeterminada. A tela nunca fica muda. */}
      {running && (
        <div className="mt-3" role="status" aria-live="polite">
          <p className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-500" />
            {stage || "Processando…"}
            {analysis && (
              <span className="text-slate-400">· mostrando o que já chegou</span>
            )}
          </p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-brand-500/15">
            <div className="h-full w-1/3 animate-[loading_1.2s_ease-in-out_infinite] rounded-full bg-brand-500" />
          </div>
          <style>{`@keyframes loading{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
        </div>
      )}

      {phase === "cancelled" && !analysis && (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Análise cancelada.
        </p>
      )}

      {error && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}

      {phase === "idle" && !analysis && (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Reúne anamnese, prontuário, evolução, prescrições e histórico de
          atendimentos para preparar a consulta.
        </p>
      )}

      {analysis && <AnalysisCards a={analysis} />}

      {analysis && (
        <p className="mt-4 flex items-start gap-1.5 border-t border-brand-500/20 pt-3 text-[11px] text-slate-500 dark:text-slate-400">
          <Info className="mt-0.5 h-3 w-3 shrink-0" /> {AI_DISCLAIMER}
        </p>
      )}
    </section>
  );
}

function AnalysisCards({ a }: { a: ClinicalAnalysis }) {
  return (
    <div className="mt-4 space-y-3">
      {a.dadosInsuficientes && (
        <p className="flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <FileWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Há poucos dados cadastrados — a análise abaixo é limitada.
        </p>
      )}

      {a.resumo && (
        <Card icon={ClipboardCheck} title="1. Resumo geral">
          <p className="text-sm text-slate-700 dark:text-slate-200">{a.resumo}</p>
        </Card>
      )}

      {a.queixaPrincipal && (
        <Card icon={Stethoscope} title="2. Queixa principal">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            {a.queixaPrincipal}
          </p>
        </Card>
      )}

      {/* Alertas primeiro entre as listas: é o que muda a conduta agora. */}
      <ItemCard icon={ShieldAlert} title="Alertas importantes" items={a.alertas} tone="danger" />
      <ItemCard icon={AlertTriangle} title="Alergias" items={a.alergias} tone="danger" />
      <ItemCard icon={Pill} title="Medicamentos informados" items={a.medicamentos} />
      <ItemCard icon={HeartPulse} title="3. Histórico clínico" items={a.historico} />
      <ItemCard icon={Activity} title="Doenças prévias" items={a.doencasPrevias} />
      <ItemCard icon={Activity} title="Hábitos de vida" items={a.habitos} />
      <ItemCard icon={AlertTriangle} title="4. Fatores de risco" items={a.fatoresRisco} tone="warn" />
      <ItemCard
        icon={FileWarning}
        title="Sinais de inconsistência"
        items={a.inconsistencias}
        tone="warn"
      />
      <ItemCard
        icon={HelpCircle}
        title="6. Hipóteses clínicas (não diagnósticas)"
        items={a.hipoteses}
        note="Possibilidades a investigar — não são diagnóstico."
      />
      <StringCard icon={HelpCircle} title="7. Perguntas sugeridas" items={a.perguntasSugeridas} />
      <StringCard
        icon={FlaskConical}
        title="8. Exames possivelmente indicados"
        items={a.examesSugeridos}
        note="Sugestões para o profissional avaliar."
      />
      <StringCard icon={ListChecks} title="9. Recomendações para a consulta" items={a.recomendacoes} />
      <StringCard icon={ListChecks} title="Ainda a investigar" items={a.aInvestigar} />

      {a.conclusao && (
        <Card icon={ClipboardCheck} title="10. Conclusão">
          <p className="text-sm text-slate-700 dark:text-slate-200">{a.conclusao}</p>
          {a.prioridadeMotivo && (
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              Prioridade {PRIORITY_LABEL[a.prioridade].toLowerCase()}: {a.prioridadeMotivo}
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

const TONE = {
  plain: "border-slate-200 dark:border-ink-700",
  warn: "border-amber-300/60 dark:border-amber-500/30",
  danger: "border-rose-300/60 dark:border-rose-500/30",
};

function Card({
  icon: Icon,
  title,
  tone = "plain",
  children,
}: {
  icon: LucideIcon;
  title: string;
  tone?: keyof typeof TONE;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border bg-white p-3.5 dark:bg-ink-900 ${TONE[tone]}`}>
      <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
        <Icon className="h-3.5 w-3.5 text-brand-500" /> {title}
      </h3>
      {children}
    </div>
  );
}

/** Distingue visualmente FATO REGISTRADO de INFERÊNCIA da IA. */
function SourceBadge({ source }: { source: AnalysisItem["source"] }) {
  const registro = source === "registro";
  return (
    <span
      title={
        registro
          ? "Consta literalmente no cadastro do paciente"
          : "Leitura da IA a partir dos dados — confirme na consulta"
      }
      className={`ml-1.5 shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
        registro
          ? "bg-slate-100 text-slate-500 dark:bg-ink-800 dark:text-slate-400"
          : "bg-violet-500/10 text-violet-600 dark:text-violet-300"
      }`}
    >
      {registro ? "registro" : "inferência"}
    </span>
  );
}

function ItemCard({
  icon,
  title,
  items,
  tone = "plain",
  note,
}: {
  icon: LucideIcon;
  title: string;
  items: AnalysisItem[];
  tone?: keyof typeof TONE;
  note?: string;
}) {
  if (items.length === 0) return null;
  return (
    <Card icon={icon} title={title} tone={tone}>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li
            key={i}
            className="flex items-start text-sm text-slate-700 dark:text-slate-200"
          >
            <span className="mr-1.5 text-slate-300">•</span>
            <span className="min-w-0 flex-1">{it.text}</span>
            <SourceBadge source={it.source} />
          </li>
        ))}
      </ul>
      {note && <p className="mt-1.5 text-[11px] text-slate-400">{note}</p>}
    </Card>
  );
}

function StringCard({
  icon,
  title,
  items,
  note,
}: {
  icon: LucideIcon;
  title: string;
  items: string[];
  note?: string;
}) {
  if (items.length === 0) return null;
  return (
    <Card icon={icon} title={title}>
      <ul className="space-y-1">
        {items.map((t, i) => (
          <li key={i} className="flex items-start gap-1.5 text-sm text-slate-700 dark:text-slate-200">
            <span className="text-slate-300">•</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
      {note && <p className="mt-1.5 text-[11px] text-slate-400">{note}</p>}
    </Card>
  );
}
