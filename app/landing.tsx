"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Sparkles,
  Play,
  Check,
  ShieldCheck,
  BarChart3,
  Wallet,
  ShoppingCart,
  Tags,
  Users,
  Boxes,
  Factory,
  Truck,
  FileText,
  Building2,
  UserCog,
  Bot,
  Brain,
  TrendingUp,
  AlertTriangle,
  Workflow,
  Zap,
  MessageCircle,
  FileSpreadsheet,
  Database,
  Store,
  Mail,
  LineChart,
  Bell,
  Gauge,
  Rocket,
  Clock,
  Lock,
  ChevronDown,
  Menu,
  X,
  PlugZap,
  Layers,
  Coins,
  Target,
  type LucideIcon,
} from "lucide-react";
import { BrandMark } from "@/app/components/BrandMark";

/* ------------------------------------------------------------------ *
 * Utilidades de animação
 * ------------------------------------------------------------------ */
function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`fade-up ${shown ? "in" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/**
 * Contador animado: sobe até o valor quando entra na viewport (easing cúbico).
 * Respeita prefers-reduced-motion (pula direto pro valor final).
 */
function CountUp({
  to,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 1400,
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [val, setVal] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setStarted(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVal(to);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(to * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // Garantia: se o rAF for suprimido (aba em segundo plano etc.), o valor
    // final entra mesmo assim.
    const guard = setTimeout(() => setVal(to), duration + 300);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(guard);
    };
  }, [started, to, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {val.toLocaleString("pt-BR", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

/**
 * Card com spotlight: um realce radial segue o cursor (CSS vars --mx/--my
 * lidas pelo ::before de .spot-card). Custo ~zero: só estilo, sem re-render.
 */
function SpotlightCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
      className={`spot-card ${className}`}
    >
      {children}
    </div>
  );
}

/* ================================================================== *
 * LANDING
 * ================================================================== */
export default function Landing() {
  return (
    <div className="relative overflow-x-clip">
      <div className="aurora" aria-hidden />
      <div className="aurora-beacon" aria-hidden />
      <Navbar />
      <Hero />
      <TrustStrip />
      <About />
      {/* A cadeia vem cedo: é o argumento que separa "mais um ERP" de
          "um ecossistema", e sustenta tudo que vem depois. */}
      <Connected />
      <Features />
      <AISection />
      <Benefits />
      <Integrations />
      <Showcase />
      <Solutions />
      <Faq />
      <FinalCta />
      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Navbar
 * ------------------------------------------------------------------ */
// "Planos" saiu do menu de âncoras e virou link para /precos: a home não
// compara preço, mas quem entra procurando valores não pode ficar sem caminho.
const NAV_LINKS = [
  { href: "#sobre", label: "Sobre" },
  { href: "#conectado", label: "Tudo conectado" },
  { href: "#recursos", label: "Funcionalidades" },
  { href: "#ia", label: "Inteligência" },
  { href: "#faq", label: "FAQ" },
];

function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("");
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll-spy: destaca o link da seção visível (faixa central da viewport).
  useEffect(() => {
    const els = NAV_LINKS.map((l) =>
      document.getElementById(l.href.slice(1)),
    ).filter((el): el is HTMLElement => Boolean(el));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) setActive(`#${e.target.id}`);
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <nav
      className={`sticky top-0 z-50 border-b transition-colors ${
        scrolled
          ? "border-ink-800 bg-ink-950/80 backdrop-blur-xl"
          : "border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
        <a href="#topo" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30">
            <BrandMark className="h-7 w-7" />
          </span>
          <span className="text-lg font-semibold tracking-tight">ENDURANCE</span>
          <span className="ml-1 hidden rounded-full border border-ink-600 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-400 sm:inline">
            ERP
          </span>
        </a>

        <div className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={`nav-link text-sm transition ${
                active === l.href
                  ? "active text-slate-100"
                  : "text-slate-400 hover:text-slate-100"
              }`}
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <a
            href="/precos"
            className="hidden text-sm text-slate-400 transition hover:text-slate-100 lg:inline"
          >
            Planos
          </a>
          <a
            href="/entrar"
            className="text-sm text-slate-300 transition hover:text-white"
          >
            Entrar
          </a>
          <a
            href="/onboarding"
            className="btn-sheen inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-ink-950 transition hover:bg-brand-400"
          >
            Teste grátis <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="grid h-9 w-9 place-items-center rounded-lg border border-ink-700 text-slate-300 md:hidden"
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="menu-in border-t border-ink-800 bg-ink-950/95 px-5 py-4 backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-ink-800"
              >
                {l.label}
              </a>
            ))}
            <a
              href="/precos"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-ink-800"
            >
              Planos
            </a>
            <div className="mt-2 flex gap-2">
              <a
                href="/entrar"
                className="flex-1 rounded-xl border border-ink-700 px-4 py-2.5 text-center text-sm text-slate-200"
              >
                Entrar
              </a>
              <a
                href="/onboarding"
                className="flex-1 rounded-xl bg-brand-500 px-4 py-2.5 text-center text-sm font-semibold text-ink-950"
              >
                Teste grátis
              </a>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

/* ------------------------------------------------------------------ *
 * Hero
 * ------------------------------------------------------------------ */
function Hero() {
  return (
    <header id="topo" className="relative">
      <div className="grid-bg pointer-events-none absolute inset-0 -z-10" aria-hidden />
      <div className="mx-auto max-w-7xl px-5 pb-10 pt-16 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-200">
              <Sparkles className="h-3.5 w-3.5" />
              ERP inteligente com IA nativa
            </span>
          </Reveal>
          <Reveal delay={60}>
            <h1 className="mt-6 text-4xl font-bold leading-[1.06] tracking-tight sm:text-6xl">
              Da venda ao caixa, do estoque à nota:
              <br className="hidden sm:block" />{" "}
              <span className="text-gradient shine-text">
                quando tudo se conecta, a gestão flui
              </span>
            </h1>
          </Reveal>
          <Reveal delay={120}>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-400">
              Vendas, estoque, financeiro, fiscal, logística e produção num
              único ecossistema — cada informação entra uma vez e percorre a
              operação inteira. Com inteligência artificial lendo os números
              junto com você.
            </p>
          </Reveal>
          <Reveal delay={180}>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href="/onboarding"
                className="btn-sheen inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-ink-950 transition hover:bg-brand-400 sm:w-auto"
              >
                Começar teste gratuito <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#conectado"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-ink-600 bg-ink-900/60 px-6 py-3 text-sm font-semibold text-slate-100 backdrop-blur transition hover:border-brand-500/60 hover:bg-ink-800/60 sm:w-auto"
              >
                <Play className="h-4 w-4 text-brand-300" /> Veja como funciona
              </a>
            </div>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-brand-400" /> Sem cartão de
                crédito
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-brand-400" /> Configuração em
                minutos
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-brand-400" /> Suporte humano
              </span>
            </div>
          </Reveal>
        </div>

        {/* Mockup */}
        <Reveal delay={300} className="mt-14">
          <DashboardMock />
        </Reveal>
      </div>
    </header>
  );
}

function DashboardMock() {
  const bars = [38, 52, 44, 70, 58, 86, 64, 92, 76];
  const tiltRef = useRef<HTMLDivElement | null>(null);

  // Tilt 3D sutil seguindo o cursor (só em ponteiro fino; reset ao sair).
  function onTilt(e: React.MouseEvent<HTMLDivElement>) {
    const el = tiltRef.current;
    if (!el || !window.matchMedia("(pointer: fine)").matches) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(1200px) rotateX(${(-py * 3.5).toFixed(2)}deg) rotateY(${(px * 5).toFixed(2)}deg)`;
  }
  function resetTilt() {
    const el = tiltRef.current;
    if (el) el.style.transform = "";
  }

  return (
    <div className="relative mx-auto max-w-5xl">
      {/* halo */}
      <div
        className="absolute -inset-x-10 -top-10 bottom-0 -z-10 rounded-[40px] bg-brand-500/20 blur-3xl"
        aria-hidden
      />
      <div
        ref={tiltRef}
        onMouseMove={onTilt}
        onMouseLeave={resetTilt}
        className="tilt ring-gradient overflow-hidden rounded-2xl border border-ink-700 bg-ink-900/80 shadow-2xl shadow-black/50 backdrop-blur glow"
      >
        {/* janela */}
        <div className="flex items-center gap-2 border-b border-ink-800 bg-ink-950/60 px-4 py-2.5">
          <span className="h-3 w-3 rounded-full bg-red-400/70" />
          <span className="h-3 w-3 rounded-full bg-beacon-400/70" />
          <span className="h-3 w-3 rounded-full bg-brand-400/70" />
          <span className="ml-3 hidden rounded-md bg-ink-800 px-2 py-0.5 text-[11px] text-slate-500 sm:inline">
            app.endurance.com.br/painel
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr]">
          {/* sidebar */}
          <aside className="hidden flex-col gap-1 border-r border-ink-800 bg-ink-950/40 p-3 sm:flex">
            {[
              { i: Gauge, t: "Painel", on: true },
              { i: Wallet, t: "Financeiro" },
              { i: ShoppingCart, t: "Vendas" },
              { i: Boxes, t: "Estoque" },
              { i: Users, t: "Clientes" },
              { i: FileText, t: "Fiscal" },
            ].map((r) => (
              <div
                key={r.t}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs ${
                  r.on
                    ? "bg-brand-500/15 text-brand-200"
                    : "text-slate-500"
                }`}
              >
                <r.i className="h-4 w-4" /> {r.t}
              </div>
            ))}
          </aside>

          {/* conteúdo */}
          <div className="p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Painel executivo</p>
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                  Visão geral · Junho
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-emerald-300">
                    <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    ao vivo
                  </span>
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/15 px-2.5 py-1 text-[11px] text-brand-200">
                <Sparkles className="h-3 w-3" /> Insight da IA
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { l: "Faturamento", to: 248.7, prefix: "R$ ", suffix: "k", decimals: 1, d: "+12,4%" },
                { l: "Margem", to: 34.2, prefix: "", suffix: "%", decimals: 1, d: "+2,1%" },
                { l: "Ticket médio", to: 86.4, prefix: "R$ ", suffix: "", decimals: 2, d: "+5,7%" },
              ].map((k) => (
                <div
                  key={k.l}
                  className="rounded-xl border border-ink-700 bg-ink-900/70 p-3"
                >
                  <p className="text-[11px] text-slate-500">{k.l}</p>
                  <p className="mt-1 text-base font-semibold text-slate-100 sm:text-lg">
                    <CountUp
                      to={k.to}
                      prefix={k.prefix}
                      suffix={k.suffix}
                      decimals={k.decimals}
                    />
                  </p>
                  <p className="text-[11px] font-medium text-emerald-400">
                    {k.d}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-xl border border-ink-700 bg-ink-900/70 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-medium text-slate-300">
                  Fluxo de caixa
                </p>
                <p className="text-[11px] text-slate-500">Últimos 9 meses</p>
              </div>
              <div className="flex h-28 items-end gap-2">
                {bars.map((h, i) => (
                  <div
                    key={i}
                    className="bar-grow flex-1 rounded-t bg-gradient-to-t from-brand-600/40 to-brand-400 transition-colors hover:to-brand-300"
                    style={{ height: `${h}%`, animationDelay: `${300 + i * 70}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* cartões flutuantes */}
      <div className="float absolute -left-4 top-24 hidden w-44 rounded-xl border border-ink-700 bg-ink-900/90 p-3 shadow-xl shadow-black/40 backdrop-blur lg:block">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/15 text-emerald-300">
            <TrendingUp className="h-4 w-4" />
          </span>
          <p className="text-[11px] text-slate-400">Previsão de demanda</p>
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-100">+18% em julho</p>
      </div>
      <div
        className="float absolute -right-4 bottom-16 hidden w-48 rounded-xl border border-ink-700 bg-ink-900/90 p-3 shadow-xl shadow-black/40 backdrop-blur lg:block"
        style={{ animationDelay: "1.5s" }}
      >
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-beacon-500/15 text-beacon-300">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <p className="text-[11px] text-slate-400">Alerta inteligente</p>
        </div>
        <p className="mt-2 text-xs font-medium text-slate-200">
          3 produtos com estoque crítico
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Trust strip
 * ------------------------------------------------------------------ */
function TrustStrip() {
  // Números do PRODUTO, conferíveis no sistema — não promessas de resultado.
  // Antes esta faixa anunciava "+40% de produtividade" e "-30% de tempo em
  // tarefas manuais": não medimos nem uma coisa nem outra, e prometer ganho
  // que não se mede é o tipo de número que o cliente cobra depois.
  const stats: {
    l: string;
    to?: number;
    prefix?: string;
    suffix?: string;
    decimals?: number;
    static?: string;
  }[] = [
    { to: 48, suffix: "", l: "módulos prontos para ligar" },
    { to: 27, suffix: "", l: "estados com NFC-e mapeada" },
    { static: "1 só", l: "lugar para toda a operação" },
    { static: "LGPD", l: "dados isolados por empresa" },
  ];
  return (
    <section className="border-y border-ink-800 bg-ink-950/40">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-5 py-8 sm:grid-cols-4">
        {stats.map((s, i) => (
          <Reveal key={s.l} delay={i * 80} className="text-center">
            <p className="text-gradient text-2xl font-bold sm:text-3xl">
              {s.static ?? (
                <CountUp
                  to={s.to!}
                  prefix={s.prefix}
                  suffix={s.suffix}
                  decimals={s.decimals ?? 0}
                />
              )}
            </p>
            <p className="mt-1 text-xs text-slate-500">{s.l}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Sobre
 * ------------------------------------------------------------------ */
function About() {
  const points: { icon: LucideIcon; title: string; text: string }[] = [
    {
      icon: Layers,
      title: "Tudo em um só lugar",
      text: "Centraliza financeiro, vendas, estoque, compras e fiscal — fim das planilhas soltas e sistemas que não conversam.",
    },
    {
      icon: Target,
      title: "Feito para quem produz",
      text: "Do varejo ao serviço, da pequena à média empresa: módulos que se adaptam ao seu segmento sem peso desnecessário.",
    },
    {
      icon: Coins,
      title: "Foco em lucratividade",
      text: "Visão clara de margem, custo e caixa para decidir com dados — e transformar operação em resultado.",
    },
  ];
  return (
    <section id="sobre" className="scroll-mt-20 py-24">
      <div className="mx-auto max-w-7xl px-5">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <SectionTag>O que é o ENDURANCE</SectionTag>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Um ERP que resiste — e que pensa com você
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-400">
              Inspirado no navio que sobreviveu ao gelo da Antártida, o ENDURANCE
              é a base sólida que mantém sua empresa firme: organiza a operação,
              elimina retrabalho e usa inteligência artificial para antecipar
              problemas antes que eles custem caro.
            </p>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {points.map((p, i) => (
            <Reveal key={p.title} delay={i * 90}>
              <SpotlightCard className="ring-gradient h-full rounded-2xl border border-ink-700 bg-ink-900/60 p-6 transition hover:-translate-y-1 hover:border-brand-500/40">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500/15 text-brand-300">
                  <p.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-slate-100">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  {p.text}
                </p>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Funcionalidades
 * ------------------------------------------------------------------ */
const MODULES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Gauge, title: "Dashboard Executivo", text: "KPIs do negócio reunidos em tempo real para decidir num relance." },
  { icon: Wallet, title: "Financeiro", text: "Contas a pagar e receber, fluxo de caixa, conciliação e DRE." },
  { icon: ShoppingCart, title: "Compras", text: "Pedidos de compra, cotações e reposição automática de estoque." },
  { icon: Tags, title: "Vendas", text: "PDV, orçamentos e pedidos com precificação inteligente." },
  { icon: Users, title: "CRM", text: "Funil, histórico e relacionamento centralizado com o cliente." },
  { icon: Boxes, title: "Estoque", text: "Entradas, saídas, inventário e alertas de nível crítico." },
  { icon: Factory, title: "Produção", text: "Ordens de produção, insumos e custos por etapa." },
  { icon: Truck, title: "Logística", text: "Expedição, rastreio e integração com transportadoras." },
  { icon: FileText, title: "Fiscal", text: "Emissão de NF-e e NFC-e com apuração e SPED." },
  { icon: BarChart3, title: "Relatórios Gerenciais", text: "Análises e relatórios prontos, exportáveis e agendáveis." },
  { icon: Building2, title: "Gestão de Fornecedores", text: "Cadastro, contratos e desempenho de cada parceiro." },
  { icon: Store, title: "Gestão de Clientes", text: "Base unificada, segmentação e visão 360º de cada conta." },
  { icon: UserCog, title: "Usuários e Permissões", text: "Controle de acesso por papel, auditoria e segurança." },
];

function Features() {
  return (
    <section id="recursos" className="scroll-mt-20 border-t border-ink-800 py-24">
      <div className="mx-auto max-w-7xl px-5">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <SectionTag>Módulos</SectionTag>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Tudo o que a sua empresa precisa, integrado
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-400">
              Ative apenas o que faz sentido para o seu negócio. Cada módulo
              conversa com os outros — um dado entra uma vez e flui por toda a
              operação.
            </p>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m, i) => (
            <Reveal key={m.title} delay={(i % 3) * 80}>
              <SpotlightCard className="group h-full rounded-2xl border border-ink-700 bg-ink-900/50 p-5 transition hover:-translate-y-1 hover:border-brand-500/50 hover:bg-ink-800/50">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink-800 text-brand-300 transition group-hover:scale-110 group-hover:bg-brand-500/15">
                    <m.icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-base font-semibold text-slate-100">
                    {m.title}
                  </h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">
                  {m.text}
                </p>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * IA
 * ------------------------------------------------------------------ */
const AI_FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Bot, title: "Assistente virtual", text: "Pergunte em linguagem natural e receba respostas sobre o seu negócio." },
  { icon: BarChart3, title: "Análise de indicadores", text: "A IA lê seus números e destaca o que mudou e por quê." },
  { icon: Workflow, title: "Ações corretivas", text: "Sugestões práticas para corrigir desvios de margem e caixa." },
  { icon: TrendingUp, title: "Previsão de demanda", text: "Antecipe vendas e compras com base no histórico e sazonalidade." },
  { icon: AlertTriangle, title: "Riscos operacionais", text: "Identifica rupturas, inadimplência e gargalos antes da hora." },
  { icon: Coins, title: "Insights financeiros", text: "Onde você ganha, onde perde e onde dá para economizar." },
  { icon: Zap, title: "Automação de processos", text: "Tarefas repetitivas rodando sozinhas, sem erro humano." },
  { icon: FileText, title: "Relatórios inteligentes", text: "Relatórios gerados e resumidos automaticamente em segundos." },
];

function AISection() {
  return (
    <section id="ia" className="relative scroll-mt-20 overflow-hidden py-24">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-500/20 blur-[120px]" />
      </div>
      <div className="mx-auto max-w-7xl px-5">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <Reveal>
              <SectionTag tone="beacon">O grande diferencial</SectionTag>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Inteligência artificial que{" "}
                <span className="text-gradient">trabalha por você</span>
              </h2>
              <p className="mt-4 max-w-xl text-slate-400">
                A IA do ENDURANCE não é enfeite: ela observa cada movimento da
                operação, aprende o ritmo da sua empresa e age — prevendo,
                alertando e automatizando o que antes tomava horas.
              </p>
            </Reveal>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {AI_FEATURES.map((f, i) => (
                <Reveal key={f.title} delay={(i % 2) * 70}>
                  <SpotlightCard className="flex h-full items-start gap-3 rounded-xl border border-ink-700 bg-ink-900/50 p-3.5 transition hover:border-brand-500/40">
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-500/15 text-brand-300">
                      <f.icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-100">
                        {f.title}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                        {f.text}
                      </p>
                    </div>
                  </SpotlightCard>
                </Reveal>
              ))}
            </div>
          </div>

          <Reveal delay={120}>
            <AIVisual />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function AIVisual() {
  return (
    <div className="relative mx-auto max-w-md">
      <div className="ring-gradient rounded-2xl border border-ink-700 bg-ink-900/70 p-5 shadow-2xl shadow-black/40 backdrop-blur glow">
        {/* orbe */}
        <div className="relative mb-5 grid place-items-center py-6">
          <span className="pulse-ring absolute h-20 w-20 rounded-full bg-brand-500/30" />
          <span
            className="pulse-ring absolute h-20 w-20 rounded-full bg-brand-500/30"
            style={{ animationDelay: "1.5s" }}
          />
          <span className="relative grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-indigo-500 text-ink-950 shadow-lg">
            <Brain className="h-7 w-7" />
          </span>
        </div>

        {/* "conversa" */}
        <div className="space-y-3">
          <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-tr-sm bg-brand-500/15 px-3.5 py-2 text-sm text-brand-100">
            Como foi o caixa esta semana?
          </div>
          <div className="w-fit max-w-[90%] rounded-2xl rounded-tl-sm border border-ink-700 bg-ink-950/60 px-3.5 py-2.5 text-sm text-slate-300">
            <p>
              Entradas de{" "}
              <span className="font-semibold text-slate-100">R$ 61,2k</span> e
              saídas de{" "}
              <span className="font-semibold text-slate-100">R$ 47,8k</span>.
              Saldo positivo, mas a margem caiu 2%.
            </p>
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-beacon-500/10 px-2 py-1 text-xs text-beacon-300">
              <Sparkles className="h-3 w-3" /> Sugestão: revisar 4 produtos com
              margem abaixo da meta.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-xl border border-ink-700 bg-ink-950/60 px-3 py-2 text-xs text-slate-500">
          <Bot className="h-4 w-4 text-brand-400" />
          Pergunte algo ao assistente…
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Benefícios
 * ------------------------------------------------------------------ */
const BENEFITS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Coins, title: "Redução de custos", text: "Menos retrabalho, menos perdas e mais eficiência em cada processo." },
  { icon: Rocket, title: "Mais produtividade", text: "Automação tira a equipe das tarefas manuais e devolve tempo." },
  { icon: Layers, title: "Informação centralizada", text: "Uma única fonte de verdade para toda a empresa." },
  { icon: BarChart3, title: "Decisão por dados", text: "Indicadores claros para escolher com confiança, não no achismo." },
  { icon: Workflow, title: "Tarefas no automático", text: "Fluxos repetitivos rodando sozinhos, 24 horas por dia." },
  { icon: ShieldCheck, title: "Controle operacional", text: "Visibilidade e governança de ponta a ponta da operação." },
  { icon: TrendingUp, title: "Pronto para escalar", text: "Cresça em volume e filiais sem trocar de sistema." },
];

function Benefits() {
  return (
    <section className="border-t border-ink-800 py-24">
      <div className="mx-auto max-w-7xl px-5">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <SectionTag>Resultados reais</SectionTag>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              O que a sua empresa ganha
            </h2>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((b, i) => (
            <Reveal
              key={b.title}
              delay={(i % 4) * 70}
              className={i === 0 ? "lg:row-span-2" : ""}
            >
              <SpotlightCard
                className={`flex h-full flex-col rounded-2xl border border-ink-700 p-6 transition hover:-translate-y-1 hover:border-brand-500/40 ${
                  i === 0
                    ? "bg-gradient-to-br from-brand-500/15 to-ink-900/40"
                    : "bg-ink-900/50"
                }`}
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500/15 text-brand-300">
                  <b.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-slate-100">
                  {b.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  {b.text}
                </p>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Integrações
 * ------------------------------------------------------------------ */
const INTEGRATIONS: { icon: LucideIcon; label: string }[] = [
  { icon: MessageCircle, label: "WhatsApp" },
  { icon: FileSpreadsheet, label: "Excel" },
  { icon: BarChart3, label: "Power BI" },
  { icon: PlugZap, label: "APIs externas" },
  { icon: Database, label: "Sistemas ERP" },
  { icon: Store, label: "Marketplaces" },
  { icon: Truck, label: "Transportadoras" },
  { icon: Mail, label: "E-mails corporativos" },
];

function Integrations() {
  return (
    <section className="border-t border-ink-800 py-24">
      <div className="mx-auto max-w-7xl px-5">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <SectionTag>Conectado ao seu ecossistema</SectionTag>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Integra com as ferramentas que você já usa
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-400">
              O ENDURANCE conversa com os canais e plataformas do seu dia a dia —
              os dados fluem automaticamente, sem digitação dupla.
            </p>
          </Reveal>
        </div>

        {/* diagrama central */}
        <Reveal delay={80} className="mt-12">
          <div className="mx-auto grid max-w-4xl grid-cols-2 items-stretch gap-4 sm:grid-cols-4">
            {INTEGRATIONS.map((it) => (
              <SpotlightCard
                key={it.label}
                className="flex flex-col items-center gap-2 rounded-2xl border border-ink-700 bg-ink-900/50 p-5 text-center transition hover:-translate-y-1 hover:border-brand-500/50"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-ink-800 text-brand-300">
                  <it.icon className="h-5 w-5" />
                </span>
                <span className="text-xs font-medium text-slate-300">
                  {it.label}
                </span>
              </SpotlightCard>
            ))}
          </div>
        </Reveal>

        {/* esteira */}
        <div className="marquee-mask mt-10 overflow-hidden">
          <div className="marquee-track gap-3">
            {[...INTEGRATIONS, ...INTEGRATIONS].map((it, i) => (
              <span
                key={i}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-ink-700 bg-ink-900/50 px-4 py-2 text-sm text-slate-400"
              >
                <it.icon className="h-4 w-4 text-brand-400" /> {it.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Demonstração visual
 * ------------------------------------------------------------------ */
const SHOW_ITEMS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Gauge, title: "Dashboard principal", text: "Tudo o que importa numa tela só." },
  { icon: LineChart, title: "KPIs e gráficos", text: "Tendências e metas visualizadas." },
  { icon: FileText, title: "Relatórios", text: "Prontos para apresentar e exportar." },
  { icon: Bell, title: "Alertas", text: "Avisos no momento certo." },
  { icon: Workflow, title: "Fluxos automatizados", text: "Processos rodando sem você." },
];

function Showcase() {
  return (
    <section className="border-t border-ink-800 py-24">
      <div className="mx-auto max-w-7xl px-5">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <SectionTag>Por dentro do sistema</SectionTag>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Veja o ENDURANCE em ação
            </h2>
          </Reveal>
        </div>

        <Reveal delay={80} className="mt-12">
          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            {/* tela grande */}
            <div className="ring-gradient overflow-hidden rounded-2xl border border-ink-700 bg-ink-900/70 shadow-2xl shadow-black/40 backdrop-blur">
              <div className="flex items-center justify-between border-b border-ink-800 px-5 py-3">
                <p className="text-sm font-semibold text-slate-200">
                  Painel executivo
                </p>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/15 px-2.5 py-1 text-[11px] text-brand-200">
                  <Sparkles className="h-3 w-3" /> Atualizado por IA
                </span>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { l: "Receita", v: "R$ 248,7k" },
                    { l: "Despesas", v: "R$ 163,1k" },
                    { l: "Lucro", v: "R$ 85,6k" },
                    { l: "Margem", v: "34,2%" },
                  ].map((k) => (
                    <div
                      key={k.l}
                      className="rounded-xl border border-ink-700 bg-ink-950/50 p-3"
                    >
                      <p className="text-[11px] text-slate-500">{k.l}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-100">
                        {k.v}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-xl border border-ink-700 bg-ink-950/50 p-4">
                  <div className="flex h-36 items-end gap-1.5">
                    {[30, 45, 38, 60, 52, 70, 62, 80, 72, 90, 84, 96].map(
                      (h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-t bg-gradient-to-t from-indigo-500/30 to-brand-400"
                          style={{ height: `${h}%` }}
                        />
                      ),
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* lista lateral */}
            <div className="grid content-start gap-3">
              {SHOW_ITEMS.map((s) => (
                <div
                  key={s.title}
                  className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-900/50 p-4 transition hover:border-brand-500/40"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-500/15 text-brand-300">
                    <s.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-100">
                      {s.title}
                    </p>
                    <p className="text-xs text-slate-500">{s.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Tudo conectado — o caminho que um único dado percorre
 *
 * É a seção que responde "por que um sistema só, e não cinco?". A resposta
 * não é uma lista de módulos: é o fato de que UMA venda no balcão já move o
 * estoque, emite a nota, lança o recebimento e reaparece no indicador. Por
 * isso o desenho é uma cadeia, e não mais um grid de cards.
 * ------------------------------------------------------------------ */
const CHAIN: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: ShoppingCart, title: "Venda", text: "O pedido entra no PDV ou pelo WhatsApp." },
  { icon: Boxes, title: "Estoque", text: "A baixa acontece na hora, no local certo." },
  { icon: FileText, title: "Fiscal", text: "NFC-e ou NF-e sai com os dados da venda." },
  { icon: Wallet, title: "Financeiro", text: "O recebimento cai no fluxo de caixa." },
  { icon: Truck, title: "Logística", text: "Separação e entrega seguem o pedido." },
  { icon: Factory, title: "Produção", text: "A reposição vira ordem quando falta." },
  { icon: BarChart3, title: "Indicadores", text: "Margem e giro atualizam sozinhos." },
  { icon: Brain, title: "Inteligência", text: "A IA lê o conjunto e aponta o que mudou." },
];

function Connected() {
  return (
    <section
      id="conectado"
      className="relative scroll-mt-20 overflow-hidden border-t border-ink-800 py-24"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-brand-500/40 to-transparent"
        aria-hidden
      />
      <div className="mx-auto max-w-7xl px-5">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <SectionTag>Tudo conectado</SectionTag>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Uma venda. Oito setores.{" "}
              <span className="text-gradient">Nenhuma digitação repetida.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-400">
              Não são módulos que exportam planilha um para o outro. É o mesmo
              dado atravessando a operação inteira — e chegando no indicador
              sem ninguém redigitar nada.
            </p>
          </Reveal>
        </div>

        <div className="relative mt-14">
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CHAIN.map((c, i) => (
              <Reveal key={c.title} delay={i * 70}>
                <li className="group relative h-full rounded-2xl border border-ink-700 bg-ink-900/50 p-5 transition hover:-translate-y-1 hover:border-brand-500/40">
                  <div className="flex items-center gap-3">
                    <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/25 transition group-hover:bg-brand-500/25">
                      <c.icon className="h-5 w-5" />
                    </span>
                    <span className="text-[11px] font-semibold tabular-nums text-slate-600">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <p className="mt-4 text-sm font-semibold text-slate-100">
                    {c.title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    {c.text}
                  </p>
                  {/* A seta só liga cards da MESMA linha. No fim da linha o
                      fluxo desce para o card de baixo — uma seta apontando
                      para a direita ali mandava o olho para fora da grade,
                      contra o caminho real. A numeração conduz a virada. */}
                  {(i + 1) % 4 !== 0 && (
                    <ArrowRight
                      className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-ink-600 lg:block"
                      aria-hidden
                    />
                  )}
                </li>
              </Reveal>
            ))}
          </ol>
        </div>

        <Reveal delay={200}>
          <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-slate-500">
            O mesmo vale ao contrário: cancelou a nota, o estoque volta e o
            caixa acerta. É o que muda quando a operação vive num sistema só.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Soluções — a ponte para os planos, sem preço na home
 *
 * A home não compara planos: ela vende o produto. Quem chegou até aqui já
 * entendeu o que o sistema faz e só então tem motivo para olhar valores —
 * que vivem em /precos.
 * ------------------------------------------------------------------ */
const SOLUTION_POINTS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Rocket,
    title: "Começa pequeno",
    text: "Você descreve o negócio e o sistema já liga os módulos do seu ramo. Sem implantação de meses.",
  },
  {
    icon: Layers,
    title: "Cresce junto",
    text: "Filiais, depósitos, produção e aprovações entram quando a operação pedir — sem trocar de sistema.",
  },
  {
    icon: UserCog,
    title: "Cada um vê o seu",
    text: "Papéis e permissões por módulo e por registro: o caixa não abre o financeiro.",
  },
];

function Solutions() {
  return (
    <section
      id="solucoes"
      className="scroll-mt-20 border-t border-ink-800 py-24"
    >
      <div className="mx-auto max-w-7xl px-5">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <SectionTag>Soluções</SectionTag>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Do balcão de bairro à operação com filiais
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-400">
              O mesmo sistema acompanha a empresa em cada estágio. Você liga o
              que precisa hoje e o resto espera o momento certo.
            </p>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {SOLUTION_POINTS.map((s, i) => (
            <Reveal key={s.title} delay={i * 80}>
              <SpotlightCard className="h-full rounded-2xl border border-ink-700 bg-ink-900/50 p-6 transition hover:-translate-y-1 hover:border-brand-500/40">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/25">
                  <s.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-slate-100">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  {s.text}
                </p>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>

        <Reveal delay={240}>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="/precos"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-ink-600 bg-ink-900/60 px-6 py-3 text-sm font-semibold text-slate-100 backdrop-blur transition hover:border-brand-500/60 hover:bg-ink-800/60 sm:w-auto"
            >
              Conheça as opções <ArrowRight className="h-4 w-4" />
            </a>
            <span className="text-xs text-slate-500">
              Comece grátis · sem cartão de crédito
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
/* ------------------------------------------------------------------ *
 * FAQ
 * ------------------------------------------------------------------ */
const FAQS = [
  {
    q: "Como funciona a implantação?",
    a: "A configuração inicial leva minutos: você descreve seu negócio e o ENDURANCE já liga os módulos certos. Para operações maiores, oferecemos implantação assistida com migração de dados.",
  },
  {
    q: "Preciso de treinamento para usar?",
    a: "A interface é intuitiva e guiada. Mesmo assim, disponibilizamos materiais, tutoriais em vídeo e treinamento ao vivo para a sua equipe nos planos pagos.",
  },
  {
    q: "Que tipo de suporte vocês oferecem?",
    // Sem nome de plano: a home não compara planos, e citar "Enterprise" aqui
    // obrigava o leitor a saber de cor uma tabela que ela não mostra mais.
    a: "Suporte por e-mail desde a conta gratuita, e suporte prioritário por chat e WhatsApp nas contratações pagas. Para operações maiores há gerente de conta e atendimento 24/7 — os detalhes ficam na página de planos.",
  },
  {
    q: "O sistema integra com outras ferramentas?",
    a: "Sim. Integramos com WhatsApp, Excel, Power BI, marketplaces, transportadoras, e-mails corporativos e qualquer sistema via API.",
  },
  {
    q: "Meus dados estão seguros?",
    a: "Cada empresa tem seus dados isolados (multi-tenant), com controle de acesso por papel, criptografia e backups automáticos. Segurança é prioridade.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim, não há fidelidade. Você pode mudar de plano ou cancelar a qualquer momento, e seus dados ficam disponíveis para exportação.",
  },
  {
    q: "As atualizações têm custo?",
    a: "Não. Todas as melhorias e novos recursos do seu plano são liberados automaticamente, sem cobrança extra.",
  },
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="scroll-mt-20 border-t border-ink-800 py-24">
      <div className="mx-auto max-w-3xl px-5">
        <div className="text-center">
          <Reveal>
            <SectionTag>Dúvidas frequentes</SectionTag>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Perguntas frequentes
            </h2>
          </Reveal>
        </div>

        <div className="mt-10 space-y-3">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={f.q} delay={(i % 3) * 50}>
                <div className="overflow-hidden rounded-xl border border-ink-700 bg-ink-900/50">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <span className="text-sm font-medium text-slate-100">
                      {f.q}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-brand-300 transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <div
                    className={`grid transition-all duration-300 ${
                      isOpen
                        ? "grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="px-5 pb-4 text-sm leading-relaxed text-slate-400">
                        {f.a}
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * CTA final
 * ------------------------------------------------------------------ */
function FinalCta() {
  return (
    <section id="contato" className="scroll-mt-20 px-5 py-24">
      <Reveal>
        <div className="ring-gradient relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-brand-500/30 bg-gradient-to-br from-ink-900 to-ink-950 px-6 py-16 text-center shadow-2xl shadow-brand-500/10">
          <div
            className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-brand-500/25 blur-[100px]"
            aria-hidden
          />
          <h2 className="relative text-3xl font-bold tracking-tight sm:text-4xl">
            Sua empresa já evoluiu.
            <br className="hidden sm:block" />{" "}
            <span className="text-gradient">
              Agora o sistema dela também pode.
            </span>
          </h2>
          <p className="relative mx-auto mt-4 max-w-2xl text-slate-400">
            Uma operação inteira num lugar só, com a inteligência lendo os
            números junto com você. Comece hoje — sem cartão, sem risco.
          </p>
          <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <Clock className="h-3.5 w-3.5 text-brand-400" /> Pronto em minutos
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <Lock className="h-3.5 w-3.5 text-brand-400" /> Dados isolados e
              seguros
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <Sparkles className="h-3.5 w-3.5 text-brand-400" /> IA inclusa
            </span>
          </div>
          <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="/onboarding"
              className="btn-sheen inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-7 py-3 text-sm font-semibold text-ink-950 transition hover:bg-brand-400 sm:w-auto"
            >
              Começar teste grátis <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="/precos"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-ink-600 bg-ink-900/60 px-7 py-3 text-sm font-semibold text-slate-100 transition hover:border-brand-500/60 sm:w-auto"
            >
              Conheça as opções
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Footer
 * ------------------------------------------------------------------ */
function Footer() {
  // Só destinos que existem. Antes toda a coluna apontava para `href="#"` —
  // quatorze links que não levavam a lugar nenhum, numa página cujo trabalho
  // é justamente passar confiança.
  const cols: { t: string; links: { l: string; href: string }[] }[] = [
    {
      t: "Produto",
      links: [
        { l: "Funcionalidades", href: "#recursos" },
        { l: "Tudo conectado", href: "#conectado" },
        { l: "Inteligência", href: "#ia" },
        { l: "Planos", href: "/precos" },
      ],
    },
    {
      t: "Empresa",
      links: [
        { l: "Sobre", href: "#sobre" },
        { l: "Contato", href: "#contato" },
        { l: "Status do sistema", href: "/status" },
      ],
    },
    {
      t: "Recursos",
      links: [
        { l: "Dúvidas frequentes", href: "#faq" },
        { l: "Privacidade", href: "/privacidade" },
        { l: "Termos de uso", href: "/termos" },
      ],
    },
  ];
  return (
    <footer className="border-t border-ink-800 bg-ink-950/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30">
              <BrandMark className="h-7 w-7" />
            </span>
            <span className="text-lg font-semibold tracking-tight">
              ENDURANCE
            </span>
          </div>
          <p className="mt-4 max-w-xs text-sm text-slate-500">
            O ERP inteligente que mantém sua empresa firme — feito para resistir
            e para crescer.
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.t}>
            <p className="text-sm font-semibold text-slate-200">{c.t}</p>
            <ul className="mt-4 space-y-2.5">
              {c.links.map((l) => (
                <li key={l.l}>
                  <a
                    href={l.href}
                    className="text-sm text-slate-500 transition hover:text-slate-200"
                  >
                    {l.l}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-ink-800">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-6 text-xs text-slate-600 sm:flex-row">
          <p>© {new Date().getFullYear()} ENDURANCE · Feito para resistir.</p>
          <div className="flex gap-5">
            <a href="/precos" className="transition hover:text-slate-300">
              Preços
            </a>
            <a href="/privacidade" className="transition hover:text-slate-300">
              Privacidade
            </a>
            <a href="/termos" className="transition hover:text-slate-300">
              Termos
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ *
 * Auxiliares
 * ------------------------------------------------------------------ */
function SectionTag({
  children,
  tone = "brand",
}: {
  children: ReactNode;
  tone?: "brand" | "beacon";
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wider ${
        tone === "beacon"
          ? "border-beacon-500/30 bg-beacon-500/10 text-beacon-300"
          : "border-brand-500/30 bg-brand-500/10 text-brand-200"
      }`}
    >
      {children}
    </span>
  );
}
