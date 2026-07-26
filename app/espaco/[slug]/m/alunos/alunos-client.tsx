"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Loader2,
  AlertCircle,
  Search,
  Pencil,
  X,
  Dumbbell,
  ClipboardList,
} from "lucide-react";
import type { PageMeta } from "@/lib/endurance/pagination";
import { useModalA11y } from "../../use-modal-a11y";
import {
  STUDENT_STATUSES,
  STUDENT_STATUS_LABEL,
  type StudentStatus,
} from "@/lib/endurance/students";
import type { StudentRow } from "@/lib/endurance/alunos";
import type { StudentDetail } from "@/lib/endurance/alunos";
import Pager from "../pager";
import {
  saveStudentAction,
  getStudentAction,
} from "./alunos-actions";

const STATUS_STYLE: Record<StudentStatus, string> = {
  ativo: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  trancado: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  inativo: "bg-slate-100 text-slate-500 dark:bg-ink-800 dark:text-slate-400",
};

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function AlunosClient({
  slug,
  students,
  meta,
  search,
  status,
}: {
  slug: string;
  students: StudentRow[];
  meta: PageMeta;
  search: string;
  status: string;
}) {
  const router = useRouter();
  const [term, setTerm] = useState(search);
  const [editing, setEditing] = useState<StudentDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState<string | null>(null);

  function navigate(next: { busca?: string; situacao?: string }) {
    const qs = new URLSearchParams();
    const busca = next.busca ?? term;
    const situacao = next.situacao ?? status;
    if (busca) qs.set("busca", busca);
    if (situacao) qs.set("situacao", situacao);
    router.push(`/espaco/${slug}/m/alunos${qs.toString() ? `?${qs}` : ""}`);
  }

  async function openEdit(id: string) {
    setLoadingEdit(id);
    const detail = await getStudentAction(id);
    setLoadingEdit(null);
    if (detail) setEditing(detail);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ busca: term });
          }}
          className="relative flex-1"
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar aluno por nome ou telefone…"
            aria-label="Buscar aluno"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm dark:border-ink-600 dark:bg-ink-900 dark:text-slate-100"
          />
        </form>
        <select
          value={status}
          aria-label="Filtrar por situação"
          onChange={(e) => navigate({ situacao: e.target.value })}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-ink-600 dark:bg-ink-900 dark:text-slate-100"
        >
          <option value="">Todas as situações</option>
          {STUDENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STUDENT_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-ink-950 hover:bg-brand-400"
        >
          <Plus className="h-4 w-4" /> Novo aluno
        </button>
      </div>

      {students.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center dark:border-ink-700 dark:bg-ink-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nenhum aluno encontrado. Clique em <strong>Novo aluno</strong> para
            cadastrar.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-ink-700 dark:bg-ink-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-ink-800">
                <th className="px-4 py-2.5 font-medium">Aluno</th>
                <th className="px-4 py-2.5 font-medium">Plano</th>
                <th className="px-4 py-2.5 font-medium">Mensalidade</th>
                <th className="px-4 py-2.5 font-medium">Situação</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-ink-800">
              {students.map((st) => (
                <tr key={st.id} className="hover:bg-slate-50 dark:hover:bg-ink-800/50">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-slate-800 dark:text-slate-100">
                      {st.name}
                    </p>
                    {st.phone && (
                      <p className="text-xs text-slate-400">{st.phone}</p>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                    {st.plan || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                    {st.monthlyFee > 0 ? brl(st.monthlyFee) : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[st.status]}`}
                    >
                      {STUDENT_STATUS_LABEL[st.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/espaco/${slug}/m/treinos/${st.id}`}
                        aria-label="Fichas de treino"
                        title="Fichas de treino"
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand-500 dark:hover:bg-ink-800"
                      >
                        <Dumbbell className="h-3.5 w-3.5" />
                      </Link>
                      <Link
                        href={`/espaco/${slug}/m/avaliacao/${st.id}`}
                        aria-label="Avaliações físicas"
                        title="Avaliações físicas"
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand-500 dark:hover:bg-ink-800"
                      >
                        <ClipboardList className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        onClick={() => openEdit(st.id)}
                        aria-label="Editar aluno"
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand-500 dark:hover:bg-ink-800"
                      >
                        {loadingEdit === st.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Pencil className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pager param="pagina" meta={meta} />

      {(creating || editing) && (
        <StudentModal
          student={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function StudentModal({
  student,
  onClose,
  onSaved,
}: {
  student: StudentDetail | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const ref = useModalA11y<HTMLDivElement>(onClose);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [f, setF] = useState({
    name: student?.name ?? "",
    phone: student?.phone ?? "",
    email: student?.email ?? "",
    document: student?.document ?? "",
    status: student?.status ?? "ativo",
    plan: student?.plan ?? "",
    monthlyFee: student?.monthlyFee ? String(student.monthlyFee) : "",
    goal: student?.goal ?? "",
    notes: student?.notes ?? "",
    birthDate: student?.birthDate ?? "",
    enrolledAt: student?.enrolledAt ?? new Date().toISOString().slice(0, 10),
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  function submit() {
    setError("");
    startTransition(async () => {
      const res = await saveStudentAction({
        id: student?.id,
        name: f.name,
        phone: f.phone,
        email: f.email,
        document: f.document,
        status: f.status,
        plan: f.plan,
        monthlyFee: Number(f.monthlyFee.replace(",", ".")) || 0,
        goal: f.goal,
        notes: f.notes,
        birthDate: f.birthDate || null,
        enrolledAt: f.enrolledAt || null,
      });
      if (res.ok) onSaved();
      else setError(res.error);
    });
  }

  const inputCls =
    "mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="aluno-modal-title"
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 dark:bg-ink-900 sm:max-w-lg sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="aluno-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
            {student ? "Editar aluno" : "Novo aluno"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3.5">
          <label className="block text-xs font-medium text-slate-500">
            Nome*
            <input value={f.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-slate-500">
              Telefone
              <input value={f.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} />
            </label>
            <label className="block text-xs font-medium text-slate-500">
              E-mail
              <input value={f.email} onChange={(e) => set("email", e.target.value)} className={inputCls} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-slate-500">
              Plano / modalidade
              <input value={f.plan} onChange={(e) => set("plan", e.target.value)} placeholder="Musculação, Cross…" className={inputCls} />
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Mensalidade (R$)
              <input inputMode="decimal" value={f.monthlyFee} onChange={(e) => set("monthlyFee", e.target.value)} placeholder="0,00" className={inputCls} />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="block text-xs font-medium text-slate-500">
              Situação
              <select value={f.status} onChange={(e) => set("status", e.target.value)} className={inputCls}>
                {STUDENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STUDENT_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Matrícula
              <input type="date" value={f.enrolledAt} onChange={(e) => set("enrolledAt", e.target.value)} className={inputCls} />
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Nascimento
              <input type="date" value={f.birthDate} onChange={(e) => set("birthDate", e.target.value)} className={inputCls} />
            </label>
          </div>
          <label className="block text-xs font-medium text-slate-500">
            Objetivo
            <input value={f.goal} onChange={(e) => set("goal", e.target.value)} placeholder="Hipertrofia, emagrecimento…" className={inputCls} />
          </label>
          <label className="block text-xs font-medium text-slate-500">
            Observações
            <textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className={`${inputCls} resize-none`} />
          </label>

          {error && (
            <p className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
            </p>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-ink-950 hover:bg-brand-400 disabled:opacity-40"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {student ? "Salvar" : "Cadastrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
