"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IdCard, Loader2, Check } from "lucide-react";
import {
  billingDocumentError,
  formatBillingDocument,
  onlyDigits,
} from "@/lib/endurance/billing-document";
import { saveBillingDocumentAction } from "./billing-actions";

/**
 * CPF/CNPJ do responsável pela conta.
 *
 * Mora aqui, e não na aba Fiscal, porque é dado de COBRANÇA. A separação
 * resolve um impasse real: salvar na aba Fiscal exige `fiscal.manage`, que é
 * bloqueada quando a assinatura vence — quem deixasse o teste expirar sem ter
 * preenchido ficava sem conseguir pagar. Esta tela roda sob
 * `subscription.manage`, que sobrevive à inadimplência de propósito.
 *
 * Também corrige a modelagem: psicólogo e nutricionista que emitem recibo não
 * têm por que configurar o módulo fiscal só para assinar.
 */
export default function BillingDocumentCard({
  initial,
  /** Sobe para o topo e foca quando o checkout parou por falta do documento. */
  highlight,
}: {
  initial: string;
  highlight?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(() => formatBillingDocument(initial));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const missing = onlyDigits(initial).length === 0;

  useEffect(() => {
    if (!highlight) return;
    boxRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    inputRef.current?.focus();
  }, [highlight]);

  function save() {
    // Valida na tela com a MESMA função do servidor — mensagem idêntica dos
    // dois lados, sem viagem de ida e volta para um erro de digitação.
    const problema = billingDocumentError(value);
    if (problema) {
      setError(problema);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await saveBillingDocumentAction(value);
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 4000);
        router.refresh();
      } else {
        setError(res.error ?? "Não foi possível salvar.");
      }
    });
  }

  const destaque = highlight || missing;

  return (
    <section
      ref={boxRef}
      className={`rounded-2xl border bg-white p-5 dark:bg-ink-900 ${
        destaque
          ? "border-amber-400 ring-2 ring-amber-400/30 dark:border-amber-600"
          : "border-slate-200 dark:border-ink-700"
      }`}
    >
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <IdCard className="h-4 w-4 text-brand-500" /> Dados de cobrança
      </h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {missing
          ? "Informe o CPF ou CNPJ do responsável pela conta — ele é exigido para emitir a cobrança."
          : "CPF ou CNPJ usado para emitir a cobrança da assinatura."}
      </p>

      <div className="mt-3 flex flex-wrap items-start gap-2">
        <div className="min-w-[220px] flex-1">
          <label htmlFor="doc-cobranca" className="sr-only">
            CPF ou CNPJ do responsável
          </label>
          <input
            id="doc-cobranca"
            ref={inputRef}
            value={value}
            inputMode="numeric"
            autoComplete="off"
            placeholder="000.000.000-00"
            aria-invalid={!!error}
            aria-describedby={error ? "doc-erro" : undefined}
            onChange={(e) => {
              // Formata enquanto digita, mas só quando o documento está
              // completo — formatar no meio faz o cursor pular.
              const d = onlyDigits(e.target.value).slice(0, 14);
              setValue(d.length === 11 || d.length === 14 ? formatBillingDocument(d) : d);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
            }}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
          />
        </div>
        <button
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-brand-400 disabled:opacity-50"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar
        </button>
      </div>

      {error && (
        <p id="doc-erro" role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <Check className="h-3.5 w-3.5" /> Documento salvo.
        </p>
      )}
    </section>
  );
}
