"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  ArrowLeft,
} from "lucide-react";
import { IMPORT_ENTITIES, type ImportEntitySpec } from "@/lib/endurance/import-spec";
import { validateImportAction, commitImportAction } from "./import-actions";
import {
  previewInvoicesAction,
  commitInvoicesAction,
} from "./invoice-import-actions";

type PreviewRow = { line: number; obj: Record<string, string>; errors: string[] };
type VResult = {
  ok: boolean;
  error?: string;
  columns?: { key: string; label: string }[];
  preview?: PreviewRow[];
  total?: number;
  validCount?: number;
  errorCount?: number;
};

export default function ImportClient({ slug }: { slug: string }) {
  const router = useRouter();
  const [entity, setEntity] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [text, setText] = useState("");
  const [result, setResult] = useState<VResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ imported: number; skipped: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const spec = IMPORT_ENTITIES.find((e) => e.id === entity);

  function reset() {
    setFileName("");
    setText("");
    setResult(null);
    setDone(null);
    setErr(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function pick(id: string) {
    setEntity(id);
    reset();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !entity) return;
    setDone(null);
    setErr(null);
    setFileName(f.name);
    const content = await f.text();
    setText(content);
    setBusy(true);
    const res = await validateImportAction(entity, content);
    setBusy(false);
    if (res.ok) setResult(res);
    else {
      setErr(res.error ?? "Falha ao validar.");
      setResult(null);
    }
  }

  async function commit() {
    if (!entity || !text) return;
    setBusy(true);
    setErr(null);
    const res = await commitImportAction(entity, text);
    setBusy(false);
    if (res.ok) {
      setDone({ imported: res.imported ?? 0, skipped: res.skipped ?? 0 });
      setResult(null);
      router.refresh();
    } else setErr(res.error ?? "Falha ao importar.");
  }

  // Etapa 1: escolher a entidade.
  if (!spec) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {IMPORT_ENTITIES.map((e) => (
          <button
            key={e.id}
            disabled={!e.available}
            onClick={() => e.available && pick(e.id)}
            className={`rounded-2xl border p-4 text-left transition ${
              e.available
                ? "border-slate-200 bg-white hover:border-brand-500 hover:shadow-sm dark:border-ink-700 dark:bg-ink-900"
                : "cursor-not-allowed border-dashed border-slate-200 bg-slate-50 opacity-60 dark:border-ink-800 dark:bg-ink-950"
            }`}
          >
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-brand-500" />
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {e.label}
              </span>
              {!e.available && (
                <span className="ml-auto rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-ink-800">
                  em breve
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {e.description}
            </p>
          </button>
        ))}
      </div>
    );
  }

  // Etapa 2: importar a entidade selecionada.
  return (
    <div className="space-y-4">
      <button
        onClick={() => setEntity(null)}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-brand-500 dark:text-slate-400"
      >
        <ArrowLeft className="h-4 w-4" />
        Todos os tipos
      </button>

      {spec.format === "xml" ? (
        <InvoiceImport spec={spec} />
      ) : (
        <>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-ink-700 dark:bg-ink-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Importar {spec.label}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              {spec.description}
            </p>
            {spec.note && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                {spec.note}
              </p>
            )}
          </div>
          <a
            href={`/espaco/${slug}/export/template/${spec.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600 dark:text-slate-300"
          >
            <Download className="h-4 w-4" />
            Baixar modelo
          </a>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {spec.columns.map((c) => (
            <span
              key={c.key}
              className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-ink-800 dark:text-slate-400"
            >
              {c.label}
              {c.required && <span className="text-red-500"> *</span>}
            </span>
          ))}
        </div>

        <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600 dark:text-slate-400">
          <Upload className="h-4 w-4" />
          {fileName || "Selecionar arquivo CSV preenchido"}
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={onFile}
            className="hidden"
          />
        </label>
      </div>

      {err && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {err}
        </div>
      )}

      {busy && (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Processando…
        </p>
      )}

      {done && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm">
          <p className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5" />
            Importação concluída
          </p>
          <p className="mt-1 text-emerald-700/80 dark:text-emerald-300/80">
            {done.imported} registro(s) importado(s)
            {done.skipped > 0 && ` · ${done.skipped} ignorado(s) por erro`}.
          </p>
          <button
            onClick={reset}
            className="mt-3 rounded-lg border border-emerald-500/40 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300"
          >
            Importar outro arquivo
          </button>
        </div>
      )}

      {result && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Count label="Linhas" value={result.total ?? 0} tone="slate" />
            <Count label="Válidas" value={result.validCount ?? 0} tone="emerald" />
            <Count label="Com erro" value={result.errorCount ?? 0} tone="red" />
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900">
            <p className="px-5 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
              Pré-visualização
              <span className="ml-2 font-normal text-slate-400">
                (até 60 linhas)
              </span>
            </p>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-ink-900">
                  <tr className="border-y border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-ink-800">
                    <th className="px-3 py-2 font-medium">Linha</th>
                    {result.columns?.map((c) => (
                      <th key={c.key} className="px-3 py-2 font-medium">
                        {c.label}
                      </th>
                    ))}
                    <th className="px-3 py-2 font-medium">Validação</th>
                  </tr>
                </thead>
                <tbody>
                  {result.preview?.map((r) => {
                    const bad = r.errors.length > 0;
                    return (
                      <tr
                        key={r.line}
                        className={`border-b border-slate-100 last:border-0 dark:border-ink-800 ${
                          bad ? "bg-red-500/5" : ""
                        }`}
                      >
                        <td className="px-3 py-2 text-slate-400">{r.line}</td>
                        {result.columns?.map((c) => (
                          <td
                            key={c.key}
                            className="px-3 py-2 text-slate-600 dark:text-slate-300"
                          >
                            {r.obj[c.key] || (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        ))}
                        <td className="px-3 py-2">
                          {bad ? (
                            <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              {r.errors.join("; ")}
                            </span>
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <button
            onClick={commit}
            disabled={busy || (result.validCount ?? 0) === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Importar {result.validCount ?? 0} registro(s) válido(s)
          </button>
        </>
      )}
        </>
      )}
    </div>
  );
}

function Count({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "emerald" | "red";
}) {
  const cls =
    tone === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "red"
        ? "text-red-600 dark:text-red-400"
        : "text-slate-700 dark:text-slate-200";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-center dark:border-ink-700 dark:bg-ink-900">
      <p className={`text-2xl font-bold ${cls}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

type InvFile = { name: string; text: string };
type InvRow = {
  name: string;
  ok: boolean;
  error?: string;
  chave?: string;
  modelo?: string;
  numero?: number;
  emitNome?: string;
  total?: number;
  itemsCount?: number;
  duplicate?: boolean;
};

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function InvoiceImport({ spec }: { spec: ImportEntitySpec }) {
  const router = useRouter();
  const [files, setFiles] = useState<InvFile[]>([]);
  const [rows, setRows] = useState<InvRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ imported: number; skipped: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  function reset() {
    setFiles([]);
    setRows(null);
    setDone(null);
    setErr(null);
    if (ref.current) ref.current.value = "";
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    if (list.length === 0) return;
    setDone(null);
    setErr(null);
    const read: InvFile[] = await Promise.all(
      list.map(async (f) => ({ name: f.name, text: await f.text() })),
    );
    setFiles(read);
    setBusy(true);
    const res = await previewInvoicesAction(read);
    setBusy(false);
    if (res.ok) setRows(res.rows ?? []);
    else {
      setErr(res.error ?? "Falha ao ler os XMLs.");
      setRows(null);
    }
  }

  async function commit() {
    setBusy(true);
    setErr(null);
    const res = await commitInvoicesAction(files);
    setBusy(false);
    if (res.ok) {
      setDone({ imported: res.imported ?? 0, skipped: res.skipped ?? 0 });
      setRows(null);
      router.refresh();
    } else setErr(res.error ?? "Falha ao importar.");
  }

  const okCount = rows?.filter((r) => r.ok && !r.duplicate).length ?? 0;

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-ink-700 dark:bg-ink-900">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
          Importar {spec.label} (XML)
        </h2>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          {spec.description}
        </p>
        {spec.note && (
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
            {spec.note}
          </p>
        )}
        <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600 dark:text-slate-400">
          <Upload className="h-4 w-4" />
          {files.length > 0
            ? `${files.length} arquivo(s) selecionado(s)`
            : "Selecionar um ou mais arquivos .xml"}
          <input
            ref={ref}
            type="file"
            accept=".xml,text/xml,application/xml"
            multiple
            onChange={onPick}
            className="hidden"
          />
        </label>
      </div>

      {err && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {err}
        </div>
      )}

      {busy && (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Processando…
        </p>
      )}

      {done && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm">
          <p className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5" />
            Importação concluída
          </p>
          <p className="mt-1 text-emerald-700/80 dark:text-emerald-300/80">
            {done.imported} nota(s) importada(s)
            {done.skipped > 0 && ` · ${done.skipped} ignorada(s) (inválidas/duplicadas)`}.
          </p>
          <button
            onClick={reset}
            className="mt-3 rounded-lg border border-emerald-500/40 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300"
          >
            Importar outros XMLs
          </button>
        </div>
      )}

      {rows && (
        <>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900">
            <p className="px-5 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
              Pré-visualização
            </p>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-ink-900">
                  <tr className="border-y border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-ink-800">
                    <th className="px-3 py-2 font-medium">Arquivo</th>
                    <th className="px-3 py-2 font-medium">Mod.</th>
                    <th className="px-3 py-2 font-medium">Nº</th>
                    <th className="px-3 py-2 font-medium">Emitente</th>
                    <th className="px-3 py-2 font-medium">Itens</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const bad = !r.ok || r.duplicate;
                    return (
                      <tr
                        key={i}
                        className={`border-b border-slate-100 last:border-0 dark:border-ink-800 ${
                          bad ? "bg-amber-500/5" : ""
                        }`}
                      >
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                          {r.name}
                        </td>
                        <td className="px-3 py-2 text-slate-500">{r.modelo ?? "—"}</td>
                        <td className="px-3 py-2 text-slate-500">{r.numero ?? "—"}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                          {r.emitNome ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-500">{r.itemsCount ?? "—"}</td>
                        <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">
                          {r.total !== undefined ? brl(r.total) : "—"}
                        </td>
                        <td className="px-3 py-2">
                          {!r.ok ? (
                            <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              {r.error}
                            </span>
                          ) : r.duplicate ? (
                            <span className="text-xs text-amber-600 dark:text-amber-400">
                              {r.error}
                            </span>
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <button
            onClick={commit}
            disabled={busy || okCount === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Importar {okCount} nota(s)
          </button>
        </>
      )}
    </>
  );
}
