import type { Metadata } from "next";
import Link from "next/link";
import { Compass, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { getHealthReport, type CheckLevel } from "@/lib/health";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Status do sistema — ENDURANCE",
  description:
    "Estado em tempo real dos serviços do ENDURANCE: aplicação, banco de dados e e-mail transacional.",
};

function formatUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const LEVEL_STYLES: Record<
  CheckLevel,
  { dot: string; text: string; Icon: typeof CheckCircle2 }
> = {
  ok: { dot: "bg-emerald-400", text: "text-emerald-300", Icon: CheckCircle2 },
  down: { dot: "bg-red-500", text: "text-red-300", Icon: AlertTriangle },
  info: { dot: "bg-amber-400", text: "text-amber-300", Icon: Info },
};

export default async function StatusPage() {
  const report = await getHealthReport();
  const allOk = report.ok && report.checks.every((c) => c.level === "ok");

  return (
    <div className="min-h-screen bg-ink-950 text-slate-200">
      <header className="border-b border-ink-800 bg-ink-900/40">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30">
              <Compass className="h-5 w-5" />
            </span>
            ENDURANCE
          </Link>
          <nav className="flex items-center gap-5 text-xs text-slate-400">
            <Link href="/" className="hover:text-slate-100">Início</Link>
            <Link href="/entrar" className="hover:text-slate-100">Entrar</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12">
        {/* Banner geral */}
        <div
          className={`flex items-center gap-4 rounded-2xl border p-6 ${
            report.ok
              ? "border-emerald-500/20 bg-emerald-500/5"
              : "border-red-500/20 bg-red-500/5"
          }`}
        >
          <span
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${
              report.ok ? "bg-emerald-500/15" : "bg-red-500/15"
            }`}
          >
            {report.ok ? (
              <CheckCircle2 className="h-7 w-7 text-emerald-300" />
            ) : (
              <AlertTriangle className="h-7 w-7 text-red-300" />
            )}
          </span>
          <div>
            <h1 className="text-xl font-semibold text-white">
              {allOk
                ? "Todos os sistemas operacionais"
                : report.ok
                  ? "Operacional com observações"
                  : "Falha em um serviço crítico"}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Última verificação:{" "}
              {new Date(report.checkedAt).toLocaleString("pt-BR", {
                dateStyle: "short",
                timeStyle: "medium",
              })}
            </p>
          </div>
        </div>

        {/* Lista de serviços */}
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Serviços
          </h2>
          <ul className="mt-3 divide-y divide-ink-800 overflow-hidden rounded-xl border border-ink-800 bg-ink-900/40">
            {report.checks.map((c) => {
              const s = LEVEL_STYLES[c.level];
              return (
                <li key={c.key} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
                    <span className="text-sm font-medium text-slate-100">{c.label}</span>
                  </div>
                  <span className={`flex items-center gap-2 text-sm ${s.text}`}>
                    <s.Icon className="h-4 w-4" />
                    {c.detail}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Metadados */}
        <section className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Uptime" value={formatUptime(report.uptimeSec)} />
          <Stat label="Versão" value={report.version} />
          <Stat label="Atualização" value="a cada 30s" />
        </section>

        <p className="mt-8 text-center text-xs text-slate-600">
          Dados em{" "}
          <Link href="/api/health" className="text-cyan-300 underline-offset-2 hover:underline">
            /api/health
          </Link>{" "}
          (JSON, para monitoramento externo).
        </p>
      </main>

      {/* Auto-refresh leve via meta http-equiv, sem JS de cliente. */}
      <meta httpEquiv="refresh" content="30" />

      <footer className="border-t border-ink-800 bg-ink-950">
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-3 px-5 py-6 text-xs text-slate-600 sm:flex-row">
          <p>© {new Date().getFullYear()} ENDURANCE</p>
          <div className="flex gap-5">
            <Link href="/privacidade" className="hover:text-slate-300">Privacidade</Link>
            <Link href="/termos" className="hover:text-slate-300">Termos</Link>
            <Link href="/precos" className="hover:text-slate-300">Preços</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink-800 bg-ink-900/40 px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-sm text-slate-200">{value}</p>
    </div>
  );
}
