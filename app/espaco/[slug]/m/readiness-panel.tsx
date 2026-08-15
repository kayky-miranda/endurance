import Link from "next/link";
import { ArrowRight, CircleCheck, CircleAlert, CircleX, Clock } from "lucide-react";
import type { DocReadiness, OverallStatus } from "@/lib/endurance/fiscal-readiness";

/**
 * Checklist de prontidão fiscal.
 *
 * É a resposta à pergunta que o cadastro existe para responder: *já consigo
 * emitir?* — e, quando não, **o que exatamente falta e onde resolver**.
 *
 * Cada documento tem sua própria lista porque as exigências diferem: a NFC-e
 * precisa de CSC, a NFS-e precisa de Inscrição Municipal e não precisa de
 * Estadual. Uma lista única mandaria o cliente perseguir campo que ele nunca
 * vai usar.
 */

const STEP_LABEL: Record<string, string> = {
  empresa: "Dados da empresa",
  endereco: "Endereço",
  fiscal: "Dados fiscais",
  certificado: "Certificado digital",
  emissao: "Emissão",
};

const OVERALL: Record<
  OverallStatus,
  { label: string; cls: string; Icon: typeof CircleCheck }
> = {
  completo: {
    label: "Cadastro completo — apto a emitir",
    cls: "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300",
    Icon: CircleCheck,
  },
  pendente: {
    label: "Informações pendentes",
    cls: "border-amber-400/50 bg-amber-500/5 text-amber-700 dark:text-amber-300",
    Icon: CircleAlert,
  },
  bloqueado: {
    label: "Configuração obrigatória ausente — nenhuma nota sai",
    cls: "border-red-500/40 bg-red-500/5 text-red-700 dark:text-red-300",
    Icon: CircleX,
  },
};

export default function ReadinessPanel({
  docs,
  status,
  /**
   * Quando informado, o painel oferece o caminho para resolver. Fora do
   * cadastro (na tela de NFC-e, por exemplo) o cliente lia as dez pendências e
   * ficava sem saber ONDE mexer: o painel nomeia a etapa ("· Dados fiscais"),
   * mas não levava a lugar nenhum. O wizard já abre na primeira etapa
   * incompleta, então o link simples basta.
   */
  slug,
}: {
  docs: DocReadiness[];
  status: OverallStatus;
  slug?: string;
}) {
  const suportados = docs.filter((d) => d.supported);
  // "Nenhuma nota sai" era literalmente falso quando só faltava o certificado:
  // a emissão em homologação continuava funcionando, e o cliente que via o
  // aviso vermelho e emitia mesmo assim aprendia a ignorar o vermelho.
  const soFaltaCertificado =
    status === "bloqueado" &&
    suportados.length > 0 &&
    suportados.every((d) => d.readyForTest);

  const geral = soFaltaCertificado
    ? {
        label:
          "Já dá para emitir em homologação e testar. Falta o certificado digital para as notas valerem fiscalmente.",
        cls: "border-amber-400/50 bg-amber-500/5 text-amber-700 dark:text-amber-300",
        Icon: CircleAlert,
      }
    : OVERALL[status];
  const GeralIcon = geral.Icon;
  const temPendencia = suportados.some((d) => d.pending.length > 0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Prontidão fiscal
        </h2>
        {slug && temPendencia && (
          <Link
            href={`/espaco/${slug}/estabelecimento`}
            className="inline-flex items-center gap-1 rounded-lg border border-brand-500/40 px-2.5 py-1 text-xs font-medium text-brand-600 transition hover:bg-brand-500/10 dark:text-brand-400"
          >
            Resolver no cadastro
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      <div
        className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${geral.cls}`}
      >
        <GeralIcon className="h-4 w-4 shrink-0" />
        {geral.label}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {docs.map((d) => (
          <article
            key={d.doc}
            className="rounded-xl border border-slate-200 p-3.5 dark:border-ink-700"
          >
            <header className="flex items-start gap-2">
              {!d.supported ? (
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              ) : d.ready ? (
                <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              ) : d.readyForTest ? (
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              ) : (
                <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                  {d.label}
                </p>
                <p className="text-[11px] text-slate-400">
                  {!d.supported
                    ? "Ainda não emitido pelo ENDURANCE"
                    : d.ready
                      ? "Pronto para emitir"
                      : d.readyForTest
                        ? "Emite em homologação · falta o certificado para valer fiscalmente"
                        : `${d.pending.length} ${d.pending.length === 1 ? "pendência" : "pendências"}`}
                </p>
              </div>
            </header>

            {/* Sem suporte no sistema, listar pendências faria o cliente
                configurar para algo que não vai acontecer. */}
            {d.supported && d.pending.length > 0 && (
              <ul className="mt-2.5 space-y-1.5">
                {d.pending.map((p) => (
                  <li key={p.field} className="flex items-start gap-1.5 text-xs">
                    {d.readyForTest ? (
                      <CircleAlert className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                    ) : (
                      <CircleX className="mt-0.5 h-3 w-3 shrink-0 text-red-400" />
                    )}
                    <span className="min-w-0 text-slate-600 dark:text-slate-300">
                      {p.label}
                      <span className="ml-1 text-slate-400">
                        · {STEP_LABEL[p.step] ?? p.step}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* As ressalvas (homologação, responsável legal) importam tanto
                para quem já emite quanto para quem só falta o certificado —
                escondê-las no segundo caso omitia justamente o aviso de que as
                notas de teste não têm valor fiscal. */}
            {d.supported && (d.ready || d.readyForTest) && d.warnings.length > 0 && (
              <ul className="mt-2.5 space-y-1.5">
                {d.warnings.map((w) => (
                  <li key={w.field} className="flex items-start gap-1.5 text-xs">
                    <CircleAlert className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                    <span className="min-w-0 text-slate-500 dark:text-slate-400">
                      {w.label}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
