import Link from "next/link";
import { BrandMark } from "@/app/components/BrandMark";

/**
 * Layout enxuto para páginas legais (Termos, Privacidade). Sem chrome do app,
 * navegável diretamente sem precisar estar logado.
 */
export default function LegalShell({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-ink-950 text-slate-200">
      <header className="border-b border-ink-800 bg-ink-900/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30">
              <BrandMark className="h-7 w-7" />
            </span>
            ENDURANCE
          </Link>
          <nav className="flex items-center gap-5 text-xs text-slate-400">
            <Link href="/termos" className="hover:text-slate-100">Termos</Link>
            <Link href="/privacidade" className="hover:text-slate-100">Privacidade</Link>
            <Link href="/entrar" className="hover:text-slate-100">Entrar</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        <p className="mt-1 text-xs text-slate-500">Atualizado em {updatedAt}</p>
        <div className="prose prose-invert prose-sm mt-8 max-w-none prose-headings:text-slate-100 prose-h2:mt-10 prose-h2:text-lg prose-h2:font-semibold prose-h3:mt-6 prose-h3:text-sm prose-h3:font-semibold prose-p:text-slate-300 prose-li:text-slate-300 prose-strong:text-slate-100">
          {children}
        </div>
      </main>

      <footer className="border-t border-ink-800 bg-ink-900/40">
        <div className="mx-auto max-w-3xl px-5 py-6 text-xs text-slate-500">
          © {new Date().getFullYear()} ENDURANCE. Encarregado pelo Tratamento de
          Dados (DPO): <a href="mailto:dpo@endurance.app" className="underline-offset-2 hover:underline">dpo@endurance.app</a>
        </div>
      </footer>
    </div>
  );
}
