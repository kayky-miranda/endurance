"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Loader2,
  Building2,
  UserRound,
  Search,
  Check,
  Layers,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { BrandMark } from "@/app/components/BrandMark";
import { companySignupAction } from "@/app/actions";
import { lookupCnpjPublicAction } from "./lookup-action";

/**
 * ETAPA 1 do onboarding: conta + empresa.
 *
 * A tela é dividida porque as duas metades fazem trabalhos diferentes: a
 * esquerda explica por que estamos pedindo estes dados, a direita pede. Sem a
 * esquerda, um formulário de onze campos logo na entrada parece burocracia.
 *
 * O que NÃO tem aqui: nicho, módulos e qualquer promessa de período
 * gratuito. Ramo e módulos saem da descrição na etapa 2, e falar de preço
 * antes de a pessoa conhecer o sistema é conversa fora de hora.
 */

const STEPS = ["Seus dados", "Sua empresa", "Conheça sua operação"];

const SEGMENTOS = [
  "Indústria",
  "Comércio",
  "Distribuidora",
  "Atacado",
  "Prestação de serviços",
  "Operação logística",
  "Outro",
];

const UFS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB",
  "PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

const VANTAGENS = [
  {
    icon: Layers,
    title: "Você liga só o que usa",
    text: "Os módulos são ativados conforme a operação da sua empresa.",
  },
  {
    icon: Workflow,
    title: "As áreas conversam",
    text: "O que entra numa área aparece nas outras, sem redigitar.",
  },
  {
    icon: ShieldCheck,
    title: "Dados isolados",
    text: "Cada empresa enxerga apenas as próprias informações.",
  },
];

const maskCnpj = (v: string) =>
  v
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");

const maskPhone = (v: string) =>
  v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
    .replace(/(\d{4})(\d)$/, "$1-$2");

export default function SignupClient() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);
  const [f, setF] = useState({
    ownerName: "",
    email: "",
    password: "",
    passwordConfirm: "",
    phone: "",
    razaoSocial: "",
    nomeFantasia: "",
    cnpj: "",
    segmento: "",
    estado: "",
    cidade: "",
  });

  const set = (k: keyof typeof f) => (v: string) =>
    setF((prev) => ({ ...prev, [k]: v }));

  /** Consulta pública por CNPJ. Preenche o que vier e não trava o cadastro. */
  function buscarCnpj() {
    const cnpj = f.cnpj.replace(/\D/g, "");
    if (cnpj.length !== 14) {
      setLookupMsg("Digite os 14 dígitos do CNPJ para buscar.");
      return;
    }
    setLookupMsg(null);
    setLooking(true);
    start(async () => {
      const res = await lookupCnpjPublicAction(f.cnpj);
      setLooking(false);
      if (!res.ok) {
        // Falha de consulta não pode virar impedimento: os campos continuam
        // editáveis à mão.
        setLookupMsg(res.error ?? "Não consegui consultar agora. Preencha à mão.");
        return;
      }
      setF((prev) => ({
        ...prev,
        razaoSocial: res.data.razaoSocial || prev.razaoSocial,
        nomeFantasia: res.data.nomeFantasia || prev.nomeFantasia,
        cidade: res.data.city || prev.cidade,
        estado: res.data.state || prev.estado,
      }));
      setLookupMsg("Dados encontrados e preenchidos.");
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await companySignupAction(f);
      if (res.ok && "slug" in res) router.push("/onboarding/empresa");
      else setError("error" in res ? res.error : "Não consegui criar a conta.");
    });
  }

  const input =
    "w-full rounded-xl border border-ink-600 bg-ink-950 px-3.5 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25";

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      {/* ---------------- Lado esquerdo: por que pedimos isto ------------- */}
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-ink-800 bg-ink-950 p-10 lg:flex">
        <div
          className="pointer-events-none absolute -left-20 top-1/3 h-80 w-80 rounded-full bg-brand-500/10 blur-[100px]"
          aria-hidden
        />
        <Link href="/" className="relative flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30">
            <BrandMark className="h-7 w-7" />
          </span>
          <span className="text-lg font-semibold tracking-tight text-slate-100">
            ENDURANCE
          </span>
        </Link>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-slate-100">
            Sua gestão começa aqui.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            Este cadastro não serve só para criar um acesso. Os dados que você
            informar aqui já configuram a plataforma de acordo com a realidade
            da sua empresa, e voltam preenchidos nas telas de operação.
          </p>

          <ul className="mt-8 space-y-4">
            {VANTAGENS.map((v) => (
              <li key={v.title} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-300 ring-1 ring-brand-500/20">
                  <v.icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-200">{v.title}</p>
                  <p className="text-xs leading-relaxed text-slate-500">
                    {v.text}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-600">
          Já tem conta?{" "}
          <a href="/entrar" className="text-brand-400 hover:text-brand-300">
            Entrar
          </a>
        </p>
      </aside>

      {/* ---------------- Lado direito: o formulário ---------------------- */}
      <main className="flex items-start justify-center bg-ink-900/40 px-5 py-10 sm:py-14">
        <div className="w-full max-w-xl">
          {/* Cabeçalho compacto, só no mobile (a coluna da esquerda some). */}
          <Link href="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30">
              <BrandMark className="h-6 w-6" />
            </span>
            <span className="font-semibold tracking-tight text-slate-100">
              ENDURANCE
            </span>
          </Link>

          <Progress current={0} />

          <div className="mt-6 rounded-2xl border border-ink-700 bg-ink-900/80 p-6 shadow-2xl shadow-black/30 sm:p-8">
            <h2 className="text-xl font-semibold tracking-tight text-slate-100">
              Crie sua conta
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Vamos começar conhecendo sua empresa.
            </p>

            <form onSubmit={submit} className="mt-7 space-y-7">
              <Bloco icon={UserRound} titulo="Dados da conta">
                <Campo label="Nome completo" htmlFor="ownerName">
                  <input
                    id="ownerName"
                    className={input}
                    value={f.ownerName}
                    onChange={(e) => set("ownerName")(e.target.value)}
                    placeholder="Como podemos te chamar"
                    autoComplete="name"
                    required
                  />
                </Campo>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo label="E-mail" htmlFor="email">
                    <input
                      id="email"
                      type="email"
                      className={input}
                      value={f.email}
                      onChange={(e) => set("email")(e.target.value)}
                      placeholder="voce@empresa.com.br"
                      autoComplete="email"
                      required
                    />
                  </Campo>
                  <Campo label="Telefone / WhatsApp" htmlFor="phone">
                    <input
                      id="phone"
                      className={input}
                      value={f.phone}
                      onChange={(e) => set("phone")(maskPhone(e.target.value))}
                      placeholder="(00) 00000-0000"
                      autoComplete="tel"
                      inputMode="tel"
                    />
                  </Campo>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo
                    label="Senha"
                    htmlFor="password"
                    hint="Mínimo de 8 caracteres, com letra e número."
                  >
                    <input
                      id="password"
                      type="password"
                      className={input}
                      value={f.password}
                      onChange={(e) => set("password")(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </Campo>
                  <Campo label="Confirmar senha" htmlFor="passwordConfirm">
                    <input
                      id="passwordConfirm"
                      type="password"
                      className={input}
                      value={f.passwordConfirm}
                      onChange={(e) => set("passwordConfirm")(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                    {f.passwordConfirm && f.password !== f.passwordConfirm && (
                      <p className="mt-1.5 text-xs text-amber-400">
                        As senhas ainda não são iguais.
                      </p>
                    )}
                  </Campo>
                </div>
              </Bloco>

              <Bloco icon={Building2} titulo="Dados da empresa">
                <Campo
                  label="CNPJ"
                  htmlFor="cnpj"
                  hint="Opcional. Se informar, buscamos os dados públicos para você."
                >
                  <div className="flex gap-2">
                    <input
                      id="cnpj"
                      className={input}
                      value={f.cnpj}
                      onChange={(e) => set("cnpj")(maskCnpj(e.target.value))}
                      placeholder="00.000.000/0000-00"
                      inputMode="numeric"
                    />
                    <button
                      type="button"
                      onClick={buscarCnpj}
                      disabled={looking}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-ink-600 px-3.5 text-sm text-slate-200 transition hover:border-brand-500/60 disabled:opacity-50"
                    >
                      {looking ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                      Buscar
                    </button>
                  </div>
                  {lookupMsg && (
                    <p className="mt-1.5 text-xs text-slate-400">{lookupMsg}</p>
                  )}
                </Campo>

                <Campo label="Razão social" htmlFor="razaoSocial">
                  <input
                    id="razaoSocial"
                    className={input}
                    value={f.razaoSocial}
                    onChange={(e) => set("razaoSocial")(e.target.value)}
                    placeholder="Nome registrado da empresa"
                    required
                  />
                </Campo>

                <Campo
                  label="Nome fantasia"
                  htmlFor="nomeFantasia"
                  hint="É como sua empresa aparece dentro do sistema."
                >
                  <input
                    id="nomeFantasia"
                    className={input}
                    value={f.nomeFantasia}
                    onChange={(e) => set("nomeFantasia")(e.target.value)}
                    placeholder="Como a empresa é conhecida"
                  />
                </Campo>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Campo label="Segmento" htmlFor="segmento">
                    <select
                      id="segmento"
                      className={input}
                      value={f.segmento}
                      onChange={(e) => set("segmento")(e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {SEGMENTOS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo label="Estado" htmlFor="estado">
                    <select
                      id="estado"
                      className={input}
                      value={f.estado}
                      onChange={(e) => set("estado")(e.target.value)}
                    >
                      <option value="">UF</option>
                      {UFS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo label="Cidade" htmlFor="cidade">
                    <input
                      id="cidade"
                      className={input}
                      value={f.cidade}
                      onChange={(e) => set("cidade")(e.target.value)}
                      placeholder="Cidade"
                    />
                  </Campo>
                </div>
              </Bloco>

              {error && (
                <p className="rounded-xl border border-red-500/40 bg-red-500/5 px-3.5 py-2.5 text-sm text-red-300">
                  {error}
                </p>
              )}

              <div className="flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-between">
                <a
                  href="/entrar"
                  className="text-xs text-slate-500 transition hover:text-slate-300"
                >
                  Já tenho conta
                </a>
                <button
                  type="submit"
                  disabled={pending}
                  className="btn-sheen inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-ink-950 transition hover:bg-brand-400 disabled:opacity-60 sm:w-auto"
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Continuar <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>

          <p className="mt-5 text-center text-xs leading-relaxed text-slate-600">
            Ao continuar você concorda com os{" "}
            <a href="/termos" className="text-slate-400 hover:text-slate-200">
              Termos de uso
            </a>{" "}
            e a{" "}
            <a href="/privacidade" className="text-slate-400 hover:text-slate-200">
              Política de privacidade
            </a>
            .
          </p>
        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Peças da tela
 * ------------------------------------------------------------------ */

/** Trilha das etapas. Fica visível nas duas telas do onboarding. */
export function Progress({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Etapas do cadastro">
      {STEPS.map((s, i) => {
        const feito = i < current;
        const ativo = i === current;
        return (
          <li key={s} className="flex flex-1 items-center gap-2">
            <div className="min-w-0 flex-1">
              <div
                className={`h-1 rounded-full transition-colors ${
                  feito || ativo ? "bg-brand-500" : "bg-ink-700"
                }`}
              />
              <p
                className={`mt-2 truncate text-[11px] ${
                  ativo
                    ? "font-medium text-slate-200"
                    : feito
                      ? "text-slate-400"
                      : "text-slate-600"
                }`}
              >
                <span className="tabular-nums">{i + 1}.</span> {s}
                {feito && <Check className="ml-1 inline h-3 w-3" />}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Bloco({
  icon: Icon,
  titulo,
  children,
}: {
  icon: typeof Building2;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
        <Icon className="h-3.5 w-3.5 text-brand-400" />
        {titulo}
      </p>
      {children}
    </section>
  );
}

function Campo({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-xs font-medium text-slate-400"
      >
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-[11px] text-slate-600">{hint}</p>}
    </div>
  );
}
