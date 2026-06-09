"use client";

import { useEffect, useState } from "react";
import {
  Sparkles,
  Loader2,
  MapPin,
  Building2,
  Check,
  ArrowRight,
  Compass,
  AlertCircle,
  Ship,
  MessageSquare,
  Wand2,
  PackageCheck,
  User,
  Mail,
  Lock,
  Store,
} from "lucide-react";
import type { OnboardingResult } from "@/lib/endurance/types";
import { signupAction } from "./actions";

type NicheChip = { id: string; label: string; example: string };
type ModuleCard = {
  id: string;
  label: string;
  description: string;
  scope: "core" | string[];
};

const TYPE_WORDS = ["mercado", "academia", "salão", "consultório"];

export default function OnboardingClient({
  niches,
  modules,
  aiEnabled,
}: {
  niches: NicheChip[];
  modules: ModuleCard[];
  aiEnabled: boolean;
}) {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<OnboardingResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bizName, setBizName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);

  async function analyze() {
    if (!description.trim() || loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Não consegui analisar agora.");
      }
      const data: OnboardingResult = await res.json();
      setResult(data);
      setSelected(new Set(data.suggestedModules));
      setBizName(data.businessName || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo deu errado.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup() {
    if (!result || creating || selected.size === 0) return;
    setCreating(true);
    setError("");
    try {
      const res = await signupAction({
        name: bizName,
        niche: result.niche,
        city: result.city,
        state: result.state,
        country: result.country,
        segment: result.segment,
        moduleIds: Array.from(selected),
        ownerName,
        email,
        password,
      });
      if (res.ok) {
        // Navegação completa: o cookie de sessão já foi gravado pela action.
        window.location.href = `/espaco/${res.slug}`;
      } else {
        setError(res.error);
        setCreating(false);
      }
    } catch {
      setError("Algo deu errado ao criar a conta.");
      setCreating(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const coreModules = modules.filter((m) => m.scope === "core");
  const nicheModules =
    result && result.niche !== "outro"
      ? modules.filter(
          (m) => Array.isArray(m.scope) && m.scope.includes(result.niche),
        )
      : [];

  const profileChips: { icon: typeof Building2; text: string }[] = [];
  if (result) {
    if (result.businessName)
      profileChips.push({ icon: Building2, text: result.businessName });
    if (result.segment)
      profileChips.push({ icon: Sparkles, text: result.segment });
    const loc = [result.city, result.state, result.country]
      .filter(Boolean)
      .join(" · ");
    if (loc) profileChips.push({ icon: MapPin, text: loc });
  }

  const idle = !result;

  return (
    <>
      {/* fundo animado */}
      <div className="aurora" aria-hidden />
      <div className="aurora-beacon" aria-hidden />

      <Navbar aiEnabled={aiEnabled} />

      <main className="mx-auto max-w-3xl px-5 pb-24 pt-12">
        {/* Hero */}
        <section className="mb-9">
          <p className="mb-3 text-sm font-medium uppercase tracking-widest text-brand-400">
            Sistema de gestão para o seu negócio
          </p>
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
            Conte o que você faz.
            <br />
            <span className="text-brand-400">A gente monta o resto.</span>
          </h1>
          <p className="mt-4 h-6 text-lg text-slate-300">
            Já vem pronto para o seu <Typewriter />
          </p>
          <p className="mt-4 max-w-xl leading-relaxed text-slate-400">
            Escreva uma frase sobre o seu negócio. Em segundos, o ENDURANCE
            entende o que você precisa e já deixa as ferramentas certas prontas
            para usar — sem instalação, sem planilha, sem complicação.
          </p>
        </section>

        {/* Formulário */}
        <section
          id="comecar"
          className="scroll-mt-24 rounded-2xl border border-ink-700 bg-ink-900/80 p-5 shadow-2xl shadow-black/40 backdrop-blur"
        >
          <label
            htmlFor="desc"
            className="mb-2 block text-sm font-medium text-slate-300"
          >
            Conte sobre o seu negócio
          </label>
          <textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") analyze();
            }}
            rows={3}
            placeholder="Ex.: Tenho um mercadinho de bairro em Campinas, SP."
            className="w-full resize-none rounded-xl border border-ink-600 bg-ink-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            {niches.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setDescription(n.example)}
                className="rounded-full border border-ink-600 px-3 py-1 text-xs text-slate-400 transition hover:-translate-y-0.5 hover:border-brand-500 hover:text-brand-200"
              >
                {n.example}
              </button>
            ))}
          </div>

          <div className="mt-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <p className="text-xs text-slate-500">
              {aiEnabled
                ? "A inteligência artificial lê sua descrição e organiza tudo."
                : "Demonstração: organizamos por palavras-chave. Pressione Ctrl/⌘ + Enter para enviar."}
            </p>
            <button
              type="button"
              onClick={analyze}
              disabled={loading || !description.trim()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {loading ? "Montando…" : "Montar meu sistema"}
            </button>
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </section>

        {/* Conteúdo de apoio (só quando ainda não há resultado) */}
        {idle && (
          <>
            <section id="como-funciona" className="mt-12 scroll-mt-24">
              <h2 className="mb-5 text-sm font-medium uppercase tracking-widest text-slate-500">
                Como funciona
              </h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <Step
                  icon={MessageSquare}
                  n="1"
                  title="Você conta"
                  text="Descreve o seu negócio em uma frase, do seu jeito."
                />
                <Step
                  icon={Wand2}
                  n="2"
                  title="A IA entende"
                  text="Identifica o tipo de negócio e o que ele precisa."
                />
                <Step
                  icon={PackageCheck}
                  n="3"
                  title="Tudo pronto"
                  text="As ferramentas certas já aparecem ligadas para você."
                />
              </div>
            </section>

            <section
              id="por-que"
              className="mt-8 flex scroll-mt-24 items-start gap-4 rounded-2xl border border-beacon-500/25 bg-beacon-500/5 p-5"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-beacon-500/15 text-beacon-400">
                <Ship className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-beacon-300">
                  Por que ENDURANCE?
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">
                  O nome vem do <em className="text-slate-300">Endurance</em>, o
                  navio do explorador Ernest Shackleton que ficou preso no gelo
                  da Antártida em 1915 — e cuja tripulação resistiu e sobreviveu.
                  É essa a ideia: um sistema resistente, que segura as pontas e
                  mantém o seu negócio firme mesmo quando o tempo fecha.
                </p>
              </div>
            </section>
          </>
        )}

        {/* Resultado */}
        {result && (
          <section className="reveal mt-8 space-y-6">
            {/* Tipo de negócio + certeza */}
            <div className="rounded-2xl border border-ink-700 bg-ink-900/80 p-5 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500">
                    Encontramos o seu negócio
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-brand-300">
                    {result.nicheLabel}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-ink-800 px-2.5 py-1 text-xs text-slate-400">
                  {result.source === "ai" ? "✨ por IA" : "demonstração"}
                </span>
              </div>

              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-slate-500">
                  <span>Certeza</span>
                  <span>{Math.round(result.confidence * 100)}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all duration-700"
                    style={{ width: `${Math.round(result.confidence * 100)}%` }}
                  />
                </div>
              </div>

              {profileChips.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {profileChips.map((c, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-ink-800 px-2.5 py-1 text-sm text-slate-300"
                    >
                      <c.icon className="h-3.5 w-3.5 text-brand-400" />
                      {c.text}
                    </span>
                  ))}
                </div>
              )}

              {result.summary && (
                <p className="mt-4 text-sm leading-relaxed text-slate-400">
                  {result.summary}
                </p>
              )}
            </div>

            {/* Ferramentas */}
            <ModuleSection
              title="O essencial — todo negócio usa"
              modules={coreModules}
              selected={selected}
              onToggle={toggle}
            />
            {nicheModules.length > 0 && (
              <ModuleSection
                title={`Feito para ${result.nicheLabel}`}
                modules={nicheModules}
                selected={selected}
                onToggle={toggle}
              />
            )}

            {/* Criar conta + espaço (persiste no banco e já abre a sessão) */}
            <div className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-5">
              <h3 className="text-base font-semibold text-slate-100">
                Crie sua conta e seu espaço
              </h3>
              <p className="mt-0.5 text-sm text-slate-400">
                <span className="font-semibold text-brand-200">
                  {selected.size}
                </span>{" "}
                ferramenta(s) prontas. Leva 10 segundos e seu espaço fica
                privado.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field
                  icon={Store}
                  placeholder="Nome do negócio"
                  value={bizName}
                  onChange={setBizName}
                />
                <Field
                  icon={User}
                  placeholder="Seu nome"
                  value={ownerName}
                  onChange={setOwnerName}
                />
                <Field
                  icon={Mail}
                  type="email"
                  placeholder="Seu e-mail"
                  value={email}
                  onChange={setEmail}
                />
                <Field
                  icon={Lock}
                  type="password"
                  placeholder="Senha (mín. 6 caracteres)"
                  value={password}
                  onChange={setPassword}
                  onEnter={handleSignup}
                />
              </div>

              <div className="mt-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                <p className="text-xs text-slate-500">
                  Já tem conta?{" "}
                  <a href="/entrar" className="text-brand-300 hover:underline">
                    Entrar
                  </a>
                </p>
                <button
                  type="button"
                  onClick={handleSignup}
                  disabled={selected.size === 0 || creating}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-brand-400 disabled:opacity-40 sm:w-auto"
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  {creating ? "Criando…" : "Criar meu espaço"}
                </button>
              </div>
            </div>
          </section>
        )}

        <footer className="mt-16 border-t border-ink-800 pt-6 text-center text-xs text-slate-600">
          ENDURANCE 0.1v · feito para resistir.
        </footer>
      </main>
    </>
  );
}

function Navbar({ aiEnabled }: { aiEnabled: boolean }) {
  return (
    <nav className="sticky top-0 z-30 border-b border-ink-800/80 bg-ink-950/70 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30">
            <Compass className="h-5 w-5" strokeWidth={2} />
          </div>
          <span className="text-lg font-semibold tracking-tight">ENDURANCE</span>
          <span className="ml-1 hidden rounded-full border border-ink-600 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-400 sm:inline">
            Beta
          </span>
        </div>

        <div className="hidden items-center gap-7 md:flex">
          <a
            href="#como-funciona"
            className="text-sm text-slate-400 transition hover:text-slate-100"
          >
            Como funciona
          </a>
          <a
            href="#por-que"
            className="text-sm text-slate-400 transition hover:text-slate-100"
          >
            Por que ENDURANCE
          </a>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs sm:flex ${
              aiEnabled ? "bg-brand-500/15 text-brand-200" : "bg-ink-800 text-slate-400"
            }`}
            title={
              aiEnabled
                ? "A inteligência artificial está ativa."
                : "Demonstração por palavras-chave."
            }
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${aiEnabled ? "bg-brand-400" : "bg-slate-500"}`}
            />
            {aiEnabled ? "IA ativa" : "Demonstração"}
          </span>
          <a
            href="/entrar"
            className="text-sm text-slate-300 transition hover:text-white"
          >
            Entrar
          </a>
          <a
            href="#comecar"
            className="rounded-full bg-brand-500 px-4 py-1.5 text-sm font-semibold text-ink-950 transition hover:bg-brand-400"
          >
            Começar
          </a>
        </div>
      </div>
    </nav>
  );
}

/* Efeito de digitação que cicla tipos de negócio. */
function Typewriter() {
  const [wordIdx, setWordIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const full = TYPE_WORDS[wordIdx];
    let delay = deleting ? 45 : 95;
    if (!deleting && typed === full) delay = 1500;
    if (deleting && typed === "") delay = 250;

    const t = setTimeout(() => {
      if (!deleting && typed === full) {
        setDeleting(true);
        return;
      }
      if (deleting && typed === "") {
        setDeleting(false);
        setWordIdx((i) => (i + 1) % TYPE_WORDS.length);
        return;
      }
      const next = deleting
        ? full.slice(0, typed.length - 1)
        : full.slice(0, typed.length + 1);
      setTyped(next);
    }, delay);

    return () => clearTimeout(t);
  }, [typed, deleting, wordIdx]);

  return (
    <span className="font-semibold text-brand-300">
      {typed}
      <span
        aria-hidden
        className="caret ml-0.5 inline-block h-[1.05em] w-[3px] translate-y-[3px] bg-brand-400"
      />
    </span>
  );
}

function Step({
  icon: Icon,
  n,
  title,
  text,
}: {
  icon: typeof MessageSquare;
  n: string;
  title: string;
  text: string;
}) {
  return (
    <div className="group rounded-2xl border border-ink-700 bg-ink-900/60 p-4 transition hover:-translate-y-1 hover:border-brand-500/50 hover:bg-ink-800/60">
      <div className="mb-3 flex items-center justify-between">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-ink-800 text-brand-300 transition group-hover:bg-brand-500/15">
          <Icon className="h-4 w-4" strokeWidth={2} />
        </div>
        <span className="text-xs font-semibold text-slate-600">{n}</span>
      </div>
      <p className="text-sm font-medium text-slate-100">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{text}</p>
    </div>
  );
}

function Field({
  icon: Icon,
  type = "text",
  placeholder,
  value,
  onChange,
  onEnter,
}: {
  icon: typeof User;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
}) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) onEnter();
        }}
        placeholder={placeholder}
        className="w-full rounded-xl border border-ink-600 bg-ink-950 py-2.5 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
      />
    </div>
  );
}

function ModuleSection({
  title,
  modules,
  selected,
  onToggle,
}: {
  title: string;
  modules: ModuleCard[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-slate-400">{title}</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {modules.map((m) => {
          const on = selected.has(m.id);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onToggle(m.id)}
              className={`flex items-start gap-3 rounded-xl border p-3 text-left transition hover:-translate-y-0.5 ${
                on
                  ? "border-brand-500/60 bg-brand-500/10"
                  : "border-ink-700 bg-ink-900/60 hover:border-ink-600"
              }`}
            >
              <span
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${
                  on
                    ? "border-brand-500 bg-brand-500 text-ink-950"
                    : "border-ink-600 text-transparent"
                }`}
              >
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
              <span>
                <span className="block text-sm font-medium text-slate-100">
                  {m.label}
                </span>
                <span className="block text-xs text-slate-500">
                  {m.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
