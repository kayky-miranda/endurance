"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Plus,
  Loader2,
  AlertCircle,
  Trash2,
  Printer,
  Pencil,
  X,
} from "lucide-react";
import type { ProfessionalOption } from "@/lib/endurance/agenda";
import { CERTIFICATE_KINDS } from "@/lib/endurance/certificate";
import type {
  CertificateSummary,
  CertificateFull,
} from "@/lib/endurance/certificates";
import {
  saveCertificateAction,
  deleteCertificateAction,
  getCertificateAction,
} from "../certificates-actions";
import { CidPicker } from "./prescriptions-panel";

export default function CertificatesPanel({
  slug,
  customerId,
  certificates,
  professionals,
}: {
  slug: string;
  customerId: string;
  certificates: CertificateSummary[];
  professionals: ProfessionalOption[];
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [editor, setEditor] = useState<CertificateFull | "new" | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  function openEdit(id: string) {
    setError("");
    setPendingId(id);
    startTransition(async () => {
      const full = await getCertificateAction(id);
      setPendingId(null);
      if (full) setEditor(full);
      else setError("Não foi possível abrir o atestado.");
    });
  }

  function remove(id: string) {
    if (!confirm("Remover este atestado? O histórico é preservado.")) return;
    setError("");
    setPendingId(id);
    startTransition(async () => {
      const res = await deleteCertificateAction({ id, customerId });
      setPendingId(null);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  if (editor) {
    return (
      <CertificateEditor
        customerId={customerId}
        professionals={professionals}
        certificate={editor === "new" ? null : editor}
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
          <FileText className="h-4 w-4 text-brand-500" /> Atestados
        </h2>
        <button
          onClick={() => {
            setError("");
            setEditor("new");
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-brand-400"
        >
          <Plus className="h-4 w-4" /> Novo atestado
        </button>
      </div>

      {error && (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}

      {certificates.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">Nenhum atestado emitido.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 dark:divide-ink-800">
          {certificates.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {new Date(c.issuedAt).toLocaleDateString("pt-BR")} · {c.kindLabel}
                  {c.days ? ` · ${c.days} dia(s)` : ""}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {[c.professional, c.cid ? `CID ${c.cid}` : ""].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              {pendingId === c.id ? (
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              ) : (
                <>
                  <a href={`/espaco/${slug}/atestado/${c.id}`} target="_blank" rel="noopener noreferrer" aria-label="Imprimir atestado" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand-500 dark:hover:bg-ink-800">
                    <Printer className="h-3.5 w-3.5" />
                  </a>
                  <button onClick={() => openEdit(c.id)} aria-label="Editar atestado" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand-500 dark:hover:bg-ink-800">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(c.id)} aria-label="Remover atestado" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10">
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

function CertificateEditor({
  customerId,
  professionals,
  certificate,
  onClose,
  onSaved,
}: {
  customerId: string;
  professionals: ProfessionalOption[];
  certificate: CertificateFull | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [professionalCouncil, setProfessionalCouncil] = useState(certificate?.professionalCouncil ?? "");
  const [kind, setKind] = useState(certificate?.kind ?? "afastamento");
  const [cid, setCid] = useState(certificate?.cid ?? "");
  const [cidDescription, setCidDescription] = useState(certificate?.cidDescription ?? "");
  const [days, setDays] = useState(certificate?.days != null ? String(certificate.days) : "");
  const [startDate, setStartDate] = useState(certificate?.startDate ?? new Date().toISOString().slice(0, 10));
  const [text, setText] = useState(certificate?.text ?? "");

  const inputCls =
    "mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100";

  function submit() {
    setError("");
    startTransition(async () => {
      const res = await saveCertificateAction({
        id: certificate?.id,
        customerId,
        professionalId: professionalId || null,
        professional: certificate?.professional,
        professionalCouncil,
        kind,
        cid,
        cidDescription,
        days: days ? Number(days) : null,
        startDate: startDate || null,
        text,
      });
      if (res.ok) onSaved();
      else setError(res.error);
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-900">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <FileText className="h-4 w-4 text-brand-500" /> {certificate ? "Editar atestado" : "Novo atestado"}
        </h2>
        <button onClick={onClose} aria-label="Fechar" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-800">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-500">
          Tipo
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputCls}>
            {CERTIFICATE_KINDS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Profissional
          <select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} className={inputCls}>
            <option value="">
              {certificate?.professional ? `Manter (${certificate.professional})` : "— (você)"}
            </option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
      </div>

      {kind === "afastamento" && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-slate-500">
            Dias de afastamento
            <input type="number" min={0} value={days} onChange={(e) => setDays(e.target.value)} className={inputCls} />
          </label>
          <label className="block text-xs font-medium text-slate-500">
            Início do afastamento
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
          </label>
        </div>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <CidPicker code={cid} description={cidDescription} onPick={(c, d) => { setCid(c); setCidDescription(d); }} />
        <label className="block text-xs font-medium text-slate-500">
          Registro (CRM/CRN/CRP)
          <input value={professionalCouncil} onChange={(e) => setProfessionalCouncil(e.target.value)} placeholder="CRM-SP 123456" className={inputCls} />
        </label>
      </div>

      <label className="mt-3 block text-xs font-medium text-slate-500">
        Texto / observações
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Ex.: Atesto para os devidos fins que o(a) paciente…" className={`${inputCls} resize-y`} />
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
          {certificate ? "Salvar atestado" : "Emitir atestado"}
        </button>
      </div>
    </section>
  );
}
