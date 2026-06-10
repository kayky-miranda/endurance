"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  LayoutDashboard,
  Users,
  LogOut,
  Search,
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
  Boxes,
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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { logoutAction } from "@/app/actions";
import AssistantWidget from "./assistant-widget";

export type ShellModule = { id: string; label: string; core: boolean };

const MODULE_ICONS: Record<string, LucideIcon> = {
  acesso: Shield,
  financeiro: Wallet,
  crm: Users,
  notificacoes: Bell,
  relatorios: BarChart3,
  importacao: UploadCloud,
  pdv: ScanLine,
  estoque: Boxes,
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
  avaliacao: ClipboardList,
  qr_acesso: QrCode,
  chatbot_cobranca: MessageCircle,
  agenda: CalendarDays,
  comandas: ClipboardList,
  comissoes: Percent,
  estoque_produtos: Boxes,
  fidelidade: Star,
  lembrete_whatsapp: MessageCircle,
  prontuario: ClipboardList,
  planos_alimentares: Salad,
  agenda_consultas: CalendarDays,
  evolucao: TrendingUp,
  anamnese: FileText,
  confirmacao_auto: BadgeCheck,
  recibo: Receipt,
};

export default function Shell({
  orgName,
  nicheLabel,
  slug,
  modules,
  userName,
  canManage,
<<<<<<< HEAD
<<<<<<< HEAD
  canViewDashboard = true,
=======
>>>>>>> 4601ad18c1a383bb3f7086a9290822d31bf3f5fa
=======
  canViewDashboard = true,
>>>>>>> b07ccfa (Resolve conflitos de merge (lado HEAD) e estabiliza o build)
  children,
}: {
  orgName: string;
  nicheLabel: string;
  slug: string;
  modules: ShellModule[];
  userName: string;
  canManage: boolean;
<<<<<<< HEAD
<<<<<<< HEAD
  canViewDashboard?: boolean;
=======
>>>>>>> 4601ad18c1a383bb3f7086a9290822d31bf3f5fa
=======
  canViewDashboard?: boolean;
>>>>>>> b07ccfa (Resolve conflitos de merge (lado HEAD) e estabiliza o build)
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
<<<<<<< HEAD
<<<<<<< HEAD
    pathname.startsWith(`${base}/pedido/`) ||
    pathname.startsWith(`${base}/etiquetas`)
=======
    pathname.startsWith(`${base}/pedido/`)
>>>>>>> 4601ad18c1a383bb3f7086a9290822d31bf3f5fa
=======
    pathname.startsWith(`${base}/pedido/`) ||
    pathname.startsWith(`${base}/etiquetas`)
>>>>>>> b07ccfa (Resolve conflitos de merge (lado HEAD) e estabiliza o build)
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
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30">
                <Compass className="h-4 w-4" strokeWidth={2} />
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
          <AssistantWidget />
        </div>
      </div>
    );
  }

  const core = modules.filter((m) => m.core);
  const niche = modules.filter((m) => !m.core);

  const initial = (userName || "?").trim().charAt(0).toUpperCase();

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
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30">
              <Compass className="h-5 w-5" strokeWidth={2} />
            </div>
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
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> b07ccfa (Resolve conflitos de merge (lado HEAD) e estabiliza o build)
            {canViewDashboard && (
              <NavGroup>
                <NavItem
                  href={base}
                  icon={LayoutDashboard}
                  label="Visão geral"
                  active={pathname === base}
                />
              </NavGroup>
            )}
<<<<<<< HEAD
=======
            <NavGroup>
              <NavItem
                href={base}
                icon={LayoutDashboard}
                label="Visão geral"
                active={pathname === base}
              />
            </NavGroup>
>>>>>>> 4601ad18c1a383bb3f7086a9290822d31bf3f5fa
=======
>>>>>>> b07ccfa (Resolve conflitos de merge (lado HEAD) e estabiliza o build)

            <NavGroup title="O essencial">
              {core.map((m) => (
                <NavItem
                  key={m.id}
                  href={`${base}/m/${m.id}`}
                  icon={MODULE_ICONS[m.id] ?? Box}
                  label={m.label}
                  active={pathname === `${base}/m/${m.id}`}
                />
              ))}
            </NavGroup>

            {niche.length > 0 && (
              <NavGroup title={nicheLabel}>
                {niche.map((m) => (
                  <NavItem
                    key={m.id}
                    href={`${base}/m/${m.id}`}
                    icon={MODULE_ICONS[m.id] ?? Box}
                    label={m.label}
                    active={pathname === `${base}/m/${m.id}`}
                  />
                ))}
              </NavGroup>
            )}

            {canManage && (
              <NavGroup title="Gestão">
                <NavItem
                  href={`${base}/equipe`}
                  icon={Users}
<<<<<<< HEAD
<<<<<<< HEAD
                  label="Usuários"
=======
                  label="Equipe"
>>>>>>> 4601ad18c1a383bb3f7086a9290822d31bf3f5fa
=======
                  label="Usuários"
>>>>>>> b07ccfa (Resolve conflitos de merge (lado HEAD) e estabiliza o build)
                  active={pathname === `${base}/equipe`}
                />
              </NavGroup>
            )}
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

            <div className="relative hidden max-w-xs flex-1 sm:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                placeholder="Buscar…"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-brand-500 dark:border-ink-700 dark:bg-ink-950 dark:text-slate-200"
              />
            </div>

            <div className="ml-auto flex items-center gap-2">
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
              <div className="flex items-center gap-2 pl-1">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-500 text-sm font-semibold text-ink-950">
                  {initial}
                </div>
                <span className="hidden text-sm font-medium sm:inline">
                  {userName}
                </span>
              </div>
            </div>
          </header>

          <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
        <AssistantWidget />
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
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
        active
          ? "bg-brand-500/15 font-medium text-brand-300"
          : "text-slate-400 hover:bg-ink-800 hover:text-slate-100"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
