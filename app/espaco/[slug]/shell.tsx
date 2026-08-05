"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserRound,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  ChevronLeft,
  Maximize,
  Minimize,
  Shield,
  Wallet,
  Bell,
  BarChart3,
  Activity,
  Boxes,
  ClipboardCheck,
  ArrowLeftRight,
  Package,
  Truck,
  Barcode,
  FileText,
  CreditCard,
  Layers,
  Dumbbell,
  ClipboardList,
  QrCode,
  MessageCircle,
  CalendarDays,
  Percent,
  Star,
  TrendingUp,
  BadgeCheck,
  Receipt,
  Salad,
  ScanLine,
  Box,
  Banknote,
  UploadCloud,
  GitCompare,
  ShoppingCart,
  PackageCheck,
  Palette,
  Lock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BrandMark } from "@/app/components/BrandMark";
import GlobalSearch from "./global-search";
import { logoutAction } from "@/app/actions";
import {
  moduleCategory,
  MODULE_CATEGORIES,
  allModuleIds,
} from "@/lib/endurance/catalog";
import AssistantWidget from "./assistant-widget";
import VerifyEmailBanner from "./verify-email-banner";
import UserMenu from "./user-menu";

export type ShellModule = {
  id: string;
  label: string;
  core: boolean;
  /** Disponível em plano superior — some para quem já tem. */
  locked?: boolean;
};

const MODULE_ICONS: Record<string, LucideIcon> = {
  acesso: Shield,
  financeiro: Wallet,
  crm: Users,
  notificacoes: Bell,
  relatorios: BarChart3,
  importacao: UploadCloud,
  pdv: ScanLine,
  estoque: Boxes,
  conferencia: ClipboardCheck,
  transferencias: ArrowLeftRight,
  caixa: Banknote,
  produtos: Package,
  fornecedores: Truck,
  codigo_barras: Barcode,
  nfce: Receipt,
  nfe: FileText,
  alunos: Users,
  mensalidades: CreditCard,
  planos: Layers,
  equipamentos: Dumbbell,
  treinos: Dumbbell,
  avaliacao: ClipboardList,
  qr_acesso: QrCode,
  chatbot_cobranca: MessageCircle,
  agenda: CalendarDays,
  comandas: ClipboardList,
  comissoes: Percent,
  estoque_produtos: Boxes,
  fidelidade: Star,
  lembrete_whatsapp: MessageCircle,
  pacientes: UserRound,
  prontuario: ClipboardList,
  planos_alimentares: Salad,
  agenda_consultas: CalendarDays,
  evolucao: TrendingUp,
  anamnese: FileText,
  confirmacao_auto: BadgeCheck,
  recibo: Receipt,
  relatorios_clinica: Activity,
  // Suprimentos / Compras
  compras: BarChart3,
  solicitacoes: ClipboardList,
  aprovacoes: BadgeCheck,
  cotacoes: GitCompare,
  pedidos_compra: ShoppingCart,
  recebimento: PackageCheck,
};

export default function Shell({
  orgName,
  nicheLabel,
  slug,
  modules,
  userName,
  userEmail,
  emailVerified,
  canManage,
  canManageBilling = false,
  canViewDashboard = true,
  logoDataUrl = null,
  aiMeter = null,
  children,
}: {
  orgName: string;
  nicheLabel: string;
  slug: string;
  modules: ShellModule[];
  userName: string;
  userEmail: string;
  emailVerified: boolean;
  canManage: boolean;
  canManageBilling?: boolean;
  canViewDashboard?: boolean;
  logoDataUrl?: string | null;
  /** Medidor de créditos de IA (Server Component vindo do layout). */
  aiMeter?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [fs, setFs] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("endurance-theme");
    setDark(stored === "dark");
  }, []);

  useEffect(() => {
    localStorage.setItem("endurance-theme", dark ? "dark" : "light");
  }, [dark]);

  // A página de Configurações troca o tema via este evento; o Shell (que
  // persiste no layout entre navegações) reage ao vivo, sem exigir reload.
  useEffect(() => {
    function onSetTheme(e: Event) {
      setDark((e as CustomEvent<{ dark: boolean }>).detail.dark);
    }
    window.addEventListener("endurance:set-theme", onSetTheme);
    return () => window.removeEventListener("endurance:set-theme", onSetTheme);
  }, []);

  // Fecha o drawer ao navegar.
  useEffect(() => setOpen(false), [pathname]);

  // Acompanha o estado de tela cheia (Fullscreen API).
  useEffect(() => {
    const onFs = () => setFs(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  const base = `/espaco/${slug}`;

  // Recibo, DANFE NFC-e e relatório PDF: layout limpo, otimizado para impressão.
  if (
    pathname.startsWith(`${base}/recibo/`) ||
    pathname.startsWith(`${base}/nfce/`) ||
    pathname.startsWith(`${base}/relatorio`) ||
    pathname.startsWith(`${base}/pedido/`) ||
    pathname.startsWith(`${base}/receita/`) ||
    pathname.startsWith(`${base}/atestado/`) ||
    pathname.startsWith(`${base}/paciente-resumo/`) ||
    pathname.startsWith(`${base}/etiquetas`) ||
    pathname.startsWith(`${base}/documento/`)
  ) {
    return (
      <div className={dark ? "dark" : ""}>
        <div className="min-h-screen bg-slate-100 px-4 py-8 dark:bg-ink-950 print:bg-white print:p-0">
          {children}
        </div>
      </div>
    );
  }

  // PDV opera em TELA CHEIA: sem sidebar/topbar, ocupando todo o viewport.
  if (pathname === `${base}/m/pdv`) {
    return (
      <div className={dark ? "dark" : ""}>
        <div className="flex h-screen flex-col bg-slate-100 text-slate-800 dark:bg-ink-950 dark:text-slate-100">
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 dark:border-ink-800 dark:bg-ink-900">
            <Link
              href={base}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600 dark:text-slate-300"
            >
              <ChevronLeft className="h-4 w-4" />
              Sair do caixa
            </Link>
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30">
                <BrandMark className="h-6 w-6" />
              </div>
              <span className="font-semibold tracking-tight">Caixa</span>
              <span className="hidden text-sm text-slate-400 sm:inline">
                · {orgName}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={toggleFullscreen}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600 dark:text-slate-300"
                title="Tela cheia (modo quiosque)"
              >
                {fs ? (
                  <Minimize className="h-4 w-4" />
                ) : (
                  <Maximize className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">
                  {fs ? "Sair da tela cheia" : "Tela cheia"}
                </span>
              </button>
              <button
                onClick={() => setDark((d) => !d)}
                className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:text-brand-500 dark:border-ink-700 dark:text-slate-400"
                aria-label="Alternar tema"
              >
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <span className="hidden text-sm font-medium sm:inline">
                {userName}
              </span>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
          <AssistantWidget userName={userName} />
        </div>
      </div>
    );
  }

  // Itens da navegação agrupados nas categorias do catálogo. Os itens fixos
  // (Visão geral, Usuários, Plano) entram nas suas categorias junto dos módulos.
  type NavEntry = {
    category: (typeof MODULE_CATEGORIES)[number];
    href: string;
    icon: LucideIcon;
    label: string;
    /** Só os módulos travados por plano marcam; os itens fixos nunca. */
    locked?: boolean;
  };
  const entries: NavEntry[] = [];
  if (canViewDashboard)
    entries.push({
      category: "Dashboards",
      href: base,
      icon: LayoutDashboard,
      label: "Visão geral",
    });
  // Ordena os módulos pela sequência canônica do catálogo (fluxo lógico),
  // independente da ordem em que foram ativados no espaço (OrgModule).
  const order = allModuleIds();
  const orderedModules = [...modules].sort(
    (a, b) => order.indexOf(a.id) - order.indexOf(b.id),
  );
  for (const m of orderedModules)
    entries.push({
      category: moduleCategory(m.id),
      href: `${base}/m/${m.id}`,
      icon: MODULE_ICONS[m.id] ?? Box,
      label: m.label,
      locked: m.locked,
    });
  if (canManage)
    entries.push({
      category: "Administração",
      href: `${base}/equipe`,
      icon: Users,
      label: "Usuários",
    });
  if (canManage)
    entries.push({
      category: "Administração",
      href: `${base}/aparencia`,
      icon: Palette,
      label: "Aparência",
    });
  if (canManageBilling)
    entries.push({
      category: "Administração",
      href: `${base}/assinatura`,
      icon: CreditCard,
      label: "Plano e cobrança",
    });

  // Visão geral é exata; os demais destacam também as sub-rotas (ex.: cotação/[id]).
  const isActive = (href: string) =>
    href === base
      ? pathname === base
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen bg-slate-100 text-slate-800 dark:bg-ink-950 dark:text-slate-100">
        {/* overlay mobile */}
        {open && (
          <div
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setOpen(false)}
            aria-hidden
          />
        )}

        {/* SIDEBAR (sempre escura) */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-ink-800 bg-ink-900 text-slate-300 transition-transform lg:translate-x-0 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-16 items-center gap-2.5 border-b border-ink-800 px-5">
            {logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoDataUrl}
                alt={orgName}
                className="h-9 w-9 shrink-0 rounded-lg object-contain bg-white/5 p-1"
              />
            ) : (
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30">
                <BrandMark className="h-7 w-7" />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-100">
                {orgName}
              </p>
              <p className="truncate text-[11px] text-slate-500">
                {nicheLabel}
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="ml-auto text-slate-500 lg:hidden"
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
            {MODULE_CATEGORIES.map((cat) => {
              const items = entries.filter((e) => e.category === cat);
              if (items.length === 0) return null;
              return (
                <NavGroup key={cat} title={cat}>
                  {items.map((e) => (
                    <NavItem
                      key={e.href}
                      locked={e.locked}
                      href={e.href}
                      icon={e.icon}
                      label={e.label}
                      active={isActive(e.href)}
                    />
                  ))}
                </NavGroup>
              );
            })}
          </nav>

          <div className="border-t border-ink-800 p-3">
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:bg-ink-800 hover:text-red-300"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </form>
          </div>
        </aside>

        {/* CONTEÚDO */}
        <div className="lg:pl-64">
          {/* TOPBAR */}
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 dark:border-ink-800 dark:bg-ink-900 sm:px-6">
            <button
              onClick={() => setOpen(true)}
              className="text-slate-500 lg:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="h-6 w-6" />
            </button>

            <GlobalSearch />

            <div className="ml-auto flex items-center gap-2">
              {aiMeter}
              <button
                onClick={() => setDark((d) => !d)}
                className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:text-brand-500 dark:border-ink-700 dark:text-slate-400"
                aria-label="Alternar tema"
                title="Alternar tema claro/escuro"
              >
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <button
                className="relative grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 dark:border-ink-700 dark:text-slate-400"
                aria-label="Notificações"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-brand-500" />
              </button>
              <UserMenu slug={slug} userName={userName} userEmail={userEmail} />
            </div>
          </header>

          {!emailVerified && <VerifyEmailBanner email={userEmail} />}

          <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
        <AssistantWidget userName={userName} />
      </div>
    </div>
  );
}

function NavGroup({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      {title && (
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
          {title}
        </p>
      )}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function NavItem({
  href,
  icon: Icon,
  label,
  active,
  locked = false,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  /** Disponível em plano superior: fica visível como vitrine de upgrade. */
  locked?: boolean;
}) {
  return (
    <Link
      href={href}
      title={locked ? `${label} — disponível em plano superior` : label}
      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors duration-150 ${
        active
          ? "bg-brand-500/15 font-medium text-brand-300"
          : "text-slate-400 hover:bg-ink-800/80 hover:text-slate-100"
      }`}
    >
      {/* Indicador do item ativo (barra de acento à esquerda) */}
      <span
        className={`absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r bg-brand-400 transition-opacity ${
          active ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden
      />
      <Icon
        className={`h-4 w-4 shrink-0 transition-transform duration-150 ${
          active ? "" : "group-hover:translate-x-0.5"
        }`}
      />
      <span className="truncate">{label}</span>
      {locked && (
        <Lock className="ml-auto h-3 w-3 shrink-0 text-slate-500" aria-label="Disponível em plano superior" />
      )}
    </Link>
  );
}
