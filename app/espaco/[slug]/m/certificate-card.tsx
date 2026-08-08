"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2, Upload, AlertTriangle, Check } from "lucide-react";
import {
  certMessage,
  certStatus,
  certNeedsAttention,
  type CertificateStatus,
} from "@/lib/endurance/certificate-expiry";
import { uploadCertificateAction } from "./fiscal-actions";

/**
 * Envio do certificado digital A1 da empresa do cliente.
 *
 * É o passo que habilita a emissão fiscal real sem que o ERP possua certificado
 * próprio: cada empresa traz o seu, nós cadastramos no provedor e usamos o
 * token devolvido para emitir as notas dela.
 *
 * Fica FORA do cadastro da conta de propósito. Pedir .pfx e senha na criação do
 * espaço travaria a maioria dos clientes na hora — quem costuma ter o arquivo é
 * o contador, não o dono. Aqui é um passo opcional, e só o varejo passa por ele.
 */

const TONE: Record<CertificateStatus, string> = {
  ausente: "border-slate-200 dark:border-ink-700",
  ok: "border-emerald-500/40",
  atencao: "border-amber-400 ring-1 ring-amber-400/30",
  critico: "border-amber-500 ring-2 ring-amber-500/40",
  vencido: "border-red-500 ring-2 ring-red-500/40",
};

export default function CertificateCard({
  validoAte,
  /** Já existe token da empresa no provedor? */
  habilitado,
}: {
  validoAte: string | null;
  habilitado: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const data = validoAte ? new Date(validoAte) : null;
  const status = certStatus(data);
  const mensagem = certMessage(data);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await uploadCertificateAction(form);
      if (res.ok) {
        setOkMsg(
          res.dryRun
            ? "Certificado validado no provedor (modo simulação — nada foi persistido lá)."
            : "Certificado enviado. A emissão fiscal está habilitada.",
        );
        // O arquivo e a senha saem da memória da página assim que possível.
        formRef.current?.reset();
        router.refresh();
      } else {
        setError(res.error ?? "Não foi possível enviar o certificado.");
      }
    });
  }

  const inputCls =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100";

  return (
    <section className={`rounded-2xl border bg-white p-5 dark:bg-ink-900 ${TONE[status]}`}>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <ShieldCheck className="h-4 w-4 text-brand-500" /> Certificado digital A1
      </h2>

      <p
        className={`mt-1 flex items-start gap-1.5 text-xs ${
          certNeedsAttention(status)
            ? "font-medium text-amber-700 dark:text-amber-400"
            : "text-slate-500 dark:text-slate-400"
        }`}
      >
        {certNeedsAttention(status) && (
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        )}
        {mensagem}
      </p>

      {habilitado && status === "ok" && (
        <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
          Emissão fiscal habilitada para esta empresa.
        </p>
      )}

      <form ref={formRef} onSubmit={submit} className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-slate-500">
            Arquivo do certificado (.pfx)
            <input
              type="file"
              name="certificado"
              accept=".pfx,.p12"
              required
              className={`mt-1 ${inputCls} file:mr-3 file:rounded-lg file:border-0 file:bg-brand-500/10 file:px-3 file:py-1 file:text-xs file:text-brand-600`}
            />
          </label>
          <label className="block text-xs font-medium text-slate-500">
            Senha do certificado
            <input
              type="password"
              name="senha"
              required
              autoComplete="off"
              className={`mt-1 ${inputCls}`}
            />
          </label>
        </div>

        <p className="text-[11px] text-slate-400">
          O arquivo e a senha são enviados diretamente ao provedor fiscal e não
          ficam guardados no ENDURANCE.
        </p>

        <div className="grid gap-3 sm:grid-cols-4">
          <label className="block text-xs font-medium text-slate-500">
            CEP
            <input name="cep" required className={`mt-1 ${inputCls}`} />
          </label>
          <label className="block text-xs font-medium text-slate-500 sm:col-span-2">
            Logradouro
            <input name="logradouro" required className={`mt-1 ${inputCls}`} />
          </label>
          <label className="block text-xs font-medium text-slate-500">
            Número
            <input name="numero" required className={`mt-1 ${inputCls}`} />
          </label>
          <label className="block text-xs font-medium text-slate-500 sm:col-span-2">
            Bairro
            <input name="bairro" required className={`mt-1 ${inputCls}`} />
          </label>
          <label className="block text-xs font-medium text-slate-500 sm:col-span-2">
            E-mail para o provedor
            <input name="email" type="email" className={`mt-1 ${inputCls}`} />
          </label>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {okMsg && (
          <p className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
            <Check className="h-4 w-4" /> {okMsg}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {habilitado ? "Substituir certificado" : "Enviar certificado"}
          </button>
        </div>
      </form>
    </section>
  );
}
