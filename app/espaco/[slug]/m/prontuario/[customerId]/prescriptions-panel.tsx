"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Pill,
  Plus,
  Loader2,
  AlertCircle,
  Trash2,
  Printer,
  Pencil,
  X,
  Search,
} from "lucide-react";
import type { ProfessionalOption } from "@/lib/endurance/agenda";
import type { PrescriptionSummary, PrescriptionFull } from "@/lib/endurance/prescriptions";
import type { CidCode } from "@/lib/endurance/cid";
import {
  savePrescriptionAction,
  deletePrescriptionAction,
  getPrescriptionAction,
  searchCidAction,
} from "../prescriptions-actions";

interface ItemRow {
  key: string;
  medication: string;
  dosage: string;
  quantity: string;
}

let seq = 0;
const mkRow = (): ItemRow => ({ key: `m${seq++}`, medication: "", dosage: "", quantity: "" });

export default function PrescriptionsPanel({
  slug,
  customerId,
  prescriptions,
  professionals,
}: {
  slug: string;
  customerId: string;
  prescriptions: PrescriptionSummary[];
  professionals: ProfessionalOption[];
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [editor, setEditor] = useState<PrescriptionFull | "new" | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  function openEdit(id: string) {
    setError("");
    setPendingId(id);
    startTransition(async () => {
      const full = await getPrescriptionAction(id);
      setPendingId(null);
      if (full) setEditor(full);
      else setError("Não foi possível abrir a receita.");
    });
  }

  function remove(id: string) {
    if (!confirm("Remover esta receita? O histórico é preservado.")) return;
    setError("");
    setPendingId(id);
    startTransition(async () => {
      const res = await deletePrescriptionAction({ id, customerId });
      setPendingId(null);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  if (editor) {
    return (
      <PrescriptionEditor
        customerId={customerId}
        professionals={professionals}
        prescription={editor === "new" ? null : editor}
        onClose={() => setEditor(null)}
        onSaved={() => {
          setEditor(null);
          router.refresh();
        }}
      />
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-900">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <Pill className="h-4 w-4 text-brand-500" /> Receituário
        </h2>
        <button
          onClick={() => {
            setError("");
            setEditor("new");
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-brand-400"
        >
          <Plus className="h-4 w-4" /> Nova receita
        </button>
      </div>

      {error && (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}

      {prescriptions.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">Nenhuma receita emitida.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 dark:divide-ink-800">
          {prescriptions.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {new Date(p.issuedAt).toLocaleDateString("pt-BR")} ·{" "}
                  {p.itemsCount} medicamento{p.itemsCount === 1 ? "" : "s"}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {[p.professional, p.cid ? `CID ${p.cid}` : ""].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              {pendingId === p.id ? (
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              ) : (
                <>
                  <a
                    href={`/espaco/${slug}/receita/${p.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Imprimir receita"
                    className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand-500 dark:hover:bg-ink-800"
                  >
                    <Printer className="h-3.5 w-3.5" />
                  </a>
                  <button onClick={() => openEdit(p.id)} aria-label="Editar receita" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand-500 dark:hover:bg-ink-800">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(p.id)} aria-label="Remover receita" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PrescriptionEditor({
  customerId,
  professionals,
  prescription,
  onClose,
  onSaved,
}: {
  customerId: string;
  professionals: ProfessionalOption[];
  prescription: PrescriptionFull | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [professionalId, setProfessionalId] = useState(""); // seleção só define snapshot ao salvar
  const [professionalCouncil, setProfessionalCouncil] = useState(prescription?.professionalCouncil ?? "");
  const [cid, setCid] = useState(prescription?.cid ?? "");
  const [cidDescription, setCidDescription] = useState(prescription?.cidDescription ?? "");
  const [instructions, setInstructions] = useState(prescription?.instructions ?? "");
  const [rows, setRows] = useState<ItemRow[]>(
    prescription && prescription.items.length
      ? prescription.items.map((it) => ({ key: `m${seq++}`, medication: it.medication, dosage: it.dosage, quantity: it.quantity }))
      : [mkRow()],
  );

  const update = (key: string, patch: Partial<ItemRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const removeRow = (key: string) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  const addRow = () => setRows((prev) => [...prev, mkRow()]);

  function submit() {
    setError("");
    startTransition(async () => {
      const res = await savePrescriptionAction({
        id: prescription?.id,
        customerId,
        professionalId: professionalId || null,
        professional: prescription?.professional,
        professionalCouncil,
        cid,
        cidDescription,
        instructions,
        items: rows.map((r) => ({ medication: r.medication, dosage: r.dosage, quantity: r.quantity })),
      });
      if (res.ok) onSaved();
      else setError(res.error);
    });
  }

  const inputCls =
    "rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-900">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <Pill className="h-4 w-4 text-brand-500" /> {prescription ? "Editar receita" : "Nova receita"}
        </h2>
        <button onClick={onClose} aria-label="Fechar" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-800">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-500">
          Profissional
          <select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} className={`mt-1 w-full ${inputCls}`}>
            <option value="">
              {prescription?.professional ? `Manter (${prescription.professional})` : "— (você)"}
            </option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Registro (CRM/CRN/CRP)
          <input value={professionalCouncil} onChange={(e) => setProfessionalCouncil(e.target.value)} placeholder="CRM-SP 123456" className={`mt-1 w-full ${inputCls}`} />
        </label>
      </div>

      <div className="mt-3">
        <CidPicker code={cid} description={cidDescription} onPick={(c, d) => { setCid(c); setCidDescription(d); }} />
      </div>

      {/* Itens */}
      <div className="mt-4 rounded-xl border border-slate-200 p-3 dark:border-ink-700">
        <div className="hidden gap-2 px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 sm:grid sm:grid-cols-[1fr_1fr_7rem_2rem]">
          <span>Medicamento</span>
          <span>Posologia</span>
          <span>Quantidade</span>
          <span />
        </div>
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.key} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_7rem_2rem] sm:items-center">
              <input value={r.medication} onChange={(e) => update(r.key, { medication: e.target.value })} placeholder="Ex.: Amoxicilina 500mg" aria-label="Medicamento" className={inputCls} />
              <input value={r.dosage} onChange={(e) => update(r.key, { dosage: e.target.value })} placeholder="1 cp 8/8h por 7 dias" aria-label="Posologia" className={inputCls} />
              <input value={r.quantity} onChange={(e) => update(r.key, { quantity: e.target.value })} placeholder="1 caixa" aria-label="Quantidade" className={inputCls} />
              <button onClick={() => removeRow(r.key)} disabled={rows.length === 1} aria-label="Remover item" className="grid h-8 w-8 place-items-center justify-self-start rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-30 dark:hover:bg-rose-500/10">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <button onClick={addRow} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-500 hover:border-brand-400 hover:text-brand-500 dark:border-ink-600">
          <Plus className="h-3.5 w-3.5" /> Adicionar medicamento
        </button>
      </div>

      <label className="mt-3 block text-xs font-medium text-slate-500">
        Orientações gerais
        <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} className={`mt-1 w-full ${inputCls} resize-y`} />
      </label>

      {error && (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
          Cancelar
        </button>
        <button onClick={submit} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-ink-950 hover:bg-brand-400 disabled:opacity-40">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {prescription ? "Salvar receita" : "Emitir receita"}
        </button>
      </div>
    </section>
  );
}

/** Autocomplete de CID-10 (catálogo curado) com entrada livre. */
export function CidPicker({
  code,
  description,
  onPick,
}: {
  code: string;
  description: string;
  onPick: (code: string, description: string) => void;
}) {
  const [term, setTerm] = useState(code ? `${code} — ${description}` : "");
  const [hits, setHits] = useState<CidCode[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onChange(v: string) {
    setTerm(v);
    // Entrada livre: código = primeiro token; descrição = resto.
    const m = /^([A-Za-z]\d[\w.]*)\s*(?:—|-)?\s*(.*)$/.exec(v.trim());
    if (m) onPick(m[1].toUpperCase(), m[2] ?? "");
    else onPick("", v.trim());
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 2) {
      setHits([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      const res = await searchCidAction(v);
      setHits(res);
      setOpen(res.length > 0);
    }, 200);
  }

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <label className="relative block text-xs font-medium text-slate-500">
      CID (opcional)
      <div className="relative mt-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={term}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => hits.length > 0 && setOpen(true)}
          placeholder="Busque por código ou doença (ex.: J11, gripe)"
          autoComplete="off"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
        />
      </div>
      {open && hits.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-ink-600 dark:bg-ink-900">
          {hits.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                onClick={() => {
                  onPick(c.code, c.description);
                  setTerm(`${c.code} — ${c.description}`);
                  setOpen(false);
                }}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-ink-800"
              >
                <span className="shrink-0 rounded bg-brand-500/10 px-1.5 py-0.5 text-xs font-semibold text-brand-600 dark:text-brand-300">{c.code}</span>
                <span className="text-slate-600 dark:text-slate-300">{c.description}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </label>
  );
}
