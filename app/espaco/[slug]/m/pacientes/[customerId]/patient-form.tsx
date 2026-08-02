"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, CheckCircle2, Save, Trash2 } from "lucide-react";
import type { PatientDetail } from "@/lib/endurance/pacientes";
import {
  SEX_OPTIONS,
  MARITAL_OPTIONS,
  isValidCpf,
  formatCpf,
  ageFromBirth,
} from "@/lib/endurance/patient";
import { lookupCepAction } from "../../lookup-actions";
import { savePatientAction, deletePatientAction } from "../pacientes-actions";

type FormState = Omit<PatientDetail, "id" | "attachments">;

const EMPTY: FormState = {
  name: "", phone: "", email: "", cpf: "", rg: "", birthDate: null, sex: "",
  maritalStatus: "", profession: "", cep: "", street: "", number: "",
  complement: "", district: "", city: "", state: "", insuranceName: "",
  insurancePlan: "", insuranceCard: "", insuranceValidity: null,
  responsibleName: "", responsiblePhone: "", responsibleRelation: "",
  photoUrl: "", notes: "",
};

const inputCls =
  "mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100";

export default function PatientForm({
  slug,
  patient,
}: {
  slug: string;
  patient: PatientDetail | null;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [f, setF] = useState<FormState>(() =>
    patient ? { ...EMPTY, ...stripId(patient) } : { ...EMPTY },
  );
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setF((p) => ({ ...p, [k]: v }));

  const cpfTouched = f.cpf.trim().length > 0;
  const cpfValid = cpfTouched ? isValidCpf(f.cpf) : true;
  const age = ageFromBirth(f.birthDate ? new Date(f.birthDate) : null);

  async function onCepBlur() {
    const cep = f.cep.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setCepLoading(true);
    const res = await lookupCepAction(cep);
    setCepLoading(false);
    if (res.ok) {
      setF((p) => ({
        ...p,
        city: res.data.city || p.city,
        state: res.data.state || p.state,
        street: p.street || res.data.address,
      }));
    }
  }

  function remove() {
    if (!patient) return;
    if (
      !confirm(
        `Excluir a ficha de ${patient.name}? O histórico de consultas, prontuário e financeiro é preservado.`,
      )
    )
      return;
    setError("");
    setOk("");
    startTransition(async () => {
      const res = await deletePatientAction(patient.id);
      if (res.ok) router.push(`/espaco/${slug}/m/pacientes`);
      else setError(res.error);
    });
  }

  function submit() {
    setError("");
    setOk("");
    if (cpfTouched && !cpfValid) {
      setError("CPF inválido — confira os dígitos.");
      return;
    }
    startTransition(async () => {
      const res = await savePatientAction({ id: patient?.id, ...f });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (!patient && res.id) {
        router.push(`/espaco/${slug}/m/pacientes/${res.id}`);
      } else {
        setOk("Ficha salva.");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-5">
      <Section title="Dados pessoais">
        <Field label="Nome completo*" className="sm:col-span-2">
          <input value={f.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
        </Field>
        <Field label="CPF">
          <input
            value={f.cpf}
            onChange={(e) => set("cpf", e.target.value)}
            onBlur={() => f.cpf && set("cpf", formatCpf(f.cpf))}
            placeholder="000.000.000-00"
            className={`${inputCls} ${cpfTouched && !cpfValid ? "border-rose-400" : ""}`}
          />
          {cpfTouched && !cpfValid && (
            <span className="mt-1 block text-[11px] text-rose-500">CPF inválido</span>
          )}
        </Field>
        <Field label="RG">
          <input value={f.rg} onChange={(e) => set("rg", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Nascimento">
          <input
            type="date"
            value={f.birthDate ?? ""}
            onChange={(e) => set("birthDate", e.target.value || null)}
            className={inputCls}
          />
          {age !== null && (
            <span className="mt-1 block text-[11px] text-slate-400">{age} anos</span>
          )}
        </Field>
        <Field label="Sexo">
          <select value={f.sex} onChange={(e) => set("sex", e.target.value)} className={inputCls}>
            <option value="">—</option>
            {SEX_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Estado civil">
          <select value={f.maritalStatus} onChange={(e) => set("maritalStatus", e.target.value)} className={inputCls}>
            <option value="">—</option>
            {MARITAL_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </Field>
        <Field label="Profissão">
          <input value={f.profession} onChange={(e) => set("profession", e.target.value)} className={inputCls} />
        </Field>
      </Section>

      <Section title="Contato">
        <Field label="Telefone / celular">
          <input value={f.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} />
        </Field>
        <Field label="E-mail" className="sm:col-span-2">
          <input value={f.email} onChange={(e) => set("email", e.target.value)} className={inputCls} />
        </Field>
      </Section>

      <Section title="Endereço">
        <Field label="CEP">
          <div className="relative">
            <input value={f.cep} onChange={(e) => set("cep", e.target.value)} onBlur={onCepBlur} placeholder="00000-000" className={inputCls} />
            {cepLoading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
          </div>
        </Field>
        <Field label="Logradouro" className="sm:col-span-2">
          <input value={f.street} onChange={(e) => set("street", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Número">
          <input value={f.number} onChange={(e) => set("number", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Complemento">
          <input value={f.complement} onChange={(e) => set("complement", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Bairro">
          <input value={f.district} onChange={(e) => set("district", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Cidade">
          <input value={f.city} onChange={(e) => set("city", e.target.value)} className={inputCls} />
        </Field>
        <Field label="UF">
          <input value={f.state} maxLength={2} onChange={(e) => set("state", e.target.value.toUpperCase())} className={inputCls} />
        </Field>
      </Section>

      <Section title="Convênio">
        <Field label="Convênio">
          <input value={f.insuranceName} onChange={(e) => set("insuranceName", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Plano">
          <input value={f.insurancePlan} onChange={(e) => set("insurancePlan", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Carteirinha">
          <input value={f.insuranceCard} onChange={(e) => set("insuranceCard", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Validade">
          <input type="date" value={f.insuranceValidity ?? ""} onChange={(e) => set("insuranceValidity", e.target.value || null)} className={inputCls} />
        </Field>
      </Section>

      <Section title="Responsável (menores / dependentes)">
        <Field label="Nome do responsável">
          <input value={f.responsibleName} onChange={(e) => set("responsibleName", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Telefone">
          <input value={f.responsiblePhone} onChange={(e) => set("responsiblePhone", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Parentesco">
          <input value={f.responsibleRelation} onChange={(e) => set("responsibleRelation", e.target.value)} placeholder="Mãe, pai, tutor…" className={inputCls} />
        </Field>
      </Section>

      <Section title="Outros">
        <Field label="Foto (link)" className="sm:col-span-2">
          <input value={f.photoUrl} onChange={(e) => set("photoUrl", e.target.value)} placeholder="https://…" className={inputCls} />
        </Field>
        <Field label="Observações" className="sm:col-span-3">
          <textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={3} className={`${inputCls} resize-y`} />
        </Field>
      </Section>

      {error && (
        <p className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      {ok && (
        <p className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {ok}
        </p>
      )}

      <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-slate-100 bg-white/80 py-3 backdrop-blur dark:border-ink-800 dark:bg-ink-950/70">
        {patient && (
          <button
            onClick={remove}
            disabled={busy}
            className="mr-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 disabled:opacity-40 dark:hover:bg-rose-500/10"
          >
            <Trash2 className="h-4 w-4" /> Excluir ficha
          </button>
        )}
        <button
          onClick={submit}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-semibold text-ink-950 hover:bg-brand-400 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {patient ? "Salvar ficha" : "Cadastrar paciente"}
        </button>
      </div>
    </div>
  );
}

function stripId(p: PatientDetail): FormState {
  const { id: _id, attachments: _a, ...rest } = p;
  return rest;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-900">
      <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block text-xs font-medium text-slate-500 ${className}`}>
      {label}
      {children}
    </label>
  );
}
