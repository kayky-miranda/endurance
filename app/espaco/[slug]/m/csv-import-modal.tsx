"use client";

import { useMemo, useRef, useState } from "react";
import {
  X,
  UploadCloud,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";

/**
 * Importação por planilha (CSV) genérica: upload → detecção de separador →
 * mapeamento de colunas (auto-sugerido pelo cabeçalho) → prévia → envio em
 * lotes para a server action do módulo. Aceita CSV exportado do Excel/Google
 * Sheets (";" ou ",", com aspas) — para .xlsx, salvar como CSV antes.
 */

export type CsvField = {
  key: string;
  label: string;
  required?: boolean;
  /** Palavras que sugerem a coluna no cabeçalho (minúsculas, sem acento). */
  hints: string[];
};

export type ImportOutcome = {
  ok: boolean;
  created?: number;
  updated?: number;
  errors?: string[];
  error?: string;
};

// ---- Parser CSV (aspas, separador ; ou , autodetectado, CRLF) -------------
function parseCsv(text: string): string[][] {
  const firstLine = text.slice(0, text.indexOf("\n") + 1 || text.length);
  const sep =
    (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0)
      ? ";"
      : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, ""); // remove BOM
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

export default function CsvImportModal({
  title,
  fields,
  onImport,
  onClose,
  onDone,
  templateExample,
}: {
  title: string;
  fields: CsvField[];
  /** Recebe as linhas mapeadas (key → valor) e importa no servidor. */
  onImport: (rows: Record<string, string>[]) => Promise<ImportOutcome>;
  onClose: () => void;
  /** Chamado após importação com sucesso (ex.: router.refresh()). */
  onDone: () => void;
  /** Linha de exemplo mostrada como dica de formato. */
  templateExample: string;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<string[][] | null>(null);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportOutcome | null>(null);
  const [error, setError] = useState("");

  const header = rows?.[0] ?? [];
  const dataRows = useMemo(() => (rows ? rows.slice(1) : []), [rows]);

  async function pickFile(f: File) {
    setError("");
    setResult(null);
    const text = await f.text();
    const parsed = parseCsv(text);
    if (parsed.length < 2) {
      setError("Arquivo vazio ou sem linhas de dados (a 1ª linha deve ser o cabeçalho).");
      return;
    }
    if (parsed.length > 5001) {
      setError("Limite de 5.000 linhas por importação — divida a planilha.");
      return;
    }
    // Auto-mapeia colunas pelo cabeçalho.
    const map: Record<string, number> = {};
    parsed[0].forEach((h, idx) => {
      const n = normalize(h);
      for (const field of fields) {
        if (map[field.key] !== undefined) continue;
        if (field.hints.some((hint) => n.includes(hint))) map[field.key] = idx;
      }
    });
    setMapping(map);
    setRows(parsed);
  }

  const missingRequired = fields.filter(
    (f) => f.required && mapping[f.key] === undefined,
  );

  async function run() {
    if (busy || !rows) return;
    setBusy(true);
    setError("");
    const mapped = dataRows.map((r) => {
      const obj: Record<string, string> = {};
      for (const f of fields) {
        const idx = mapping[f.key];
        obj[f.key] = idx === undefined ? "" : (r[idx] ?? "").trim();
      }
      return obj;
    });
    try {
      const res = await onImport(mapped);
      setResult(res);
      if (res.ok) onDone();
    } catch {
      setError("Falha na importação — tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-ink-700 dark:bg-ink-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
            <FileSpreadsheet className="h-5 w-5 text-brand-500" /> {title}
          </h3>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Passo 1: arquivo */}
        {!rows && (
          <div>
            <button
              onClick={() => fileRef.current?.click()}
              className="grid w-full place-items-center rounded-2xl border-2 border-dashed border-slate-300 px-6 py-10 text-center transition hover:border-brand-500 dark:border-ink-600"
            >
              <UploadCloud className="h-8 w-8 text-brand-500" />
              <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                Escolher arquivo CSV
              </p>
              <p className="mt-1 text-xs text-slate-500">
                1ª linha = cabeçalho · separador ; ou , · máx. 5.000 linhas.
                Planilha do Excel/Sheets? Salve como CSV.
              </p>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])}
            />
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-500 dark:bg-ink-950">
              Exemplo: {templateExample}
            </p>
          </div>
        )}

        {/* Passo 2: mapeamento + prévia */}
        {rows && !result && (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {fields.map((f) => (
                <label key={f.key} className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500">
                    {f.label}
                    {f.required && <span className="text-rose-500"> *</span>}
                  </span>
                  <select
                    value={mapping[f.key] ?? ""}
                    onChange={(e) =>
                      setMapping((m) => {
                        const next = { ...m };
                        if (e.target.value === "") delete next[f.key];
                        else next[f.key] = Number(e.target.value);
                        return next;
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
                  >
                    <option value="">— ignorar —</option>
                    {header.map((h, idx) => (
                      <option key={idx} value={idx}>
                        {h || `Coluna ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-ink-700">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-slate-400 dark:border-ink-800">
                    {fields.map((f) => (
                      <th key={f.key} className="px-3 py-2 font-medium">
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataRows.slice(0, 5).map((r, i) => (
                    <tr key={i} className="border-b border-slate-50 last:border-0 dark:border-ink-800">
                      {fields.map((f) => (
                        <td key={f.key} className="px-3 py-1.5 text-slate-600 dark:text-slate-300">
                          {mapping[f.key] === undefined ? "—" : r[mapping[f.key]] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">
              {dataRows.length} linha(s) para importar — prévia das 5 primeiras.
            </p>

            {missingRequired.length > 0 && (
              <p className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Mapeie: {missingRequired.map((f) => f.label).join(", ")}
              </p>
            )}
            {error && (
              <p className="flex items-center gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setRows(null);
                  setMapping({});
                }}
                className="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-ink-800"
              >
                Trocar arquivo
              </button>
              <button
                onClick={run}
                disabled={busy || missingRequired.length > 0}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-brand-400 disabled:opacity-40"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Importar {dataRows.length} linha(s)
              </button>
            </div>
          </div>
        )}

        {/* Passo 3: resultado */}
        {result && (
          <div className="space-y-3">
            {result.ok ? (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                Importação concluída: {result.created ?? 0} criado(s),{" "}
                {result.updated ?? 0} atualizado(s).
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
                <AlertCircle className="h-5 w-5 shrink-0" />
                {result.error ?? "Falha na importação."}
              </div>
            )}
            {result.errors && result.errors.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
                <p className="mb-1 font-semibold">
                  {result.errors.length} linha(s) ignorada(s):
                </p>
                {result.errors.slice(0, 30).map((e, i) => (
                  <p key={i}>{e}</p>
                ))}
                {result.errors.length > 30 && <p>…</p>}
              </div>
            )}
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-brand-400"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
