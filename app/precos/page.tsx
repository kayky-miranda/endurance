import type { Metadata } from "next";
import Link from "next/link";
import { Check, Sparkles, MessageCircle } from "lucide-react";
import { BrandMark } from "@/app/components/BrandMark";
import { PLAN_CATALOG } from "@/lib/endurance/billing";
import { SoftwareJsonLd } from "../json-ld";

export const metadata: Metadata = {
  title: "Planos e preços — ENDURANCE",
  description:
    "Escolha o plano que cabe na sua operação. Trial de 7 dias, sem cartão de crédito. Cancele quando quiser.",
};

function formatBRL(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function PrecosPage() {
  return (
    <div className="min-h-screen bg-ink-950 text-slate-200">
      <SoftwareJsonLd />
      <header className="border-b border-ink-800 bg-ink-900/40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30">
              <BrandMark className="h-5 w-5" />
            </span>
            ENDURANCE
          </Link>
          <nav className="flex items-center gap-5 text-xs text-slate-400">
            <Link href="/" className="hover:text-slate-100">Início</Link>
            <Link href="/entrar" className="hover:text-slate-100">Entrar</Link>
            <Link
              href="/#cta"
              className="rounded-lg bg-brand-500 px-3 py-1.5 font-semibold text-ink-950 hover:bg-brand-400"
            >
              Teste grátis
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 pt-16 pb-10 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-300">
          <Sparkles className="h-3 w-3" />
          7 dias grátis · sem cartão
        </span>
        <h1 className="mt-5 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Planos que crescem com a sua empresa
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-base text-slate-400">
          Comece sem custo. Pague mensal ou anual com 2 meses de bonificação. Troque de plano a qualquer momento e cancele quando quiser.
        </p>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-5 pb-16 sm:grid-cols-2 lg:grid-cols-4">
        {PLAN_CATALOG.map((plan) => (
          <div
            key={plan.id}
            className={`relative flex flex-col rounded-2xl border p-6 ${
              plan.featured
                ? "border-brand-500/60 bg-gradient-to-b from-brand-500/10 to-ink-900 shadow-xl shadow-brand-500/10"
                : "border-ink-800 bg-ink-900/60"
            }`}
          >
            {plan.featured && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-950">
                Mais escolhido
              </span>
            )}
            <h3 className="text-lg font-bold text-white">{plan.name}</h3>
            <p className="mt-1 min-h-[40px] text-xs text-slate-400">{plan.description}</p>
            <div className="mt-4">
              {plan.priceMonthly === null ? (
                <p className="text-2xl font-bold text-white">
                  Sob consulta
                </p>
              ) : plan.priceMonthly === 0 ? (
                <p className="text-2xl font-bold text-white">
                  Grátis
                  <span className="ml-1 text-sm font-normal text-slate-500">por 7 dias</span>
                </p>
              ) : (
                <p className="text-2xl font-bold text-white">
                  {formatBRL(plan.priceMonthly)}
                  <span className="ml-1 text-sm font-normal text-slate-500">/mês</span>
                </p>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {plan.seats === 0 ? "Usuários ilimitados" : `Até ${plan.seats} usuários`}
            </p>

            <ul className="mt-5 flex-1 space-y-2 text-xs text-slate-300">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-400" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6">
              {plan.contactSales ? (
                <a
                  href="https://wa.me/5511999999999?text=Quero%20conhecer%20o%20plano%20Enterprise"
                  target="_blank"
                  rel="noopener"
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:border-brand-400 hover:text-brand-300"
                >
                  <MessageCircle className="h-4 w-4" />
                  Falar com vendas
                </a>
              ) : (
                <Link
                  href="/#cta"
                  className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${
                    plan.featured
                      ? "bg-brand-500 text-ink-950 hover:bg-brand-400"
                      : "border border-slate-700 text-slate-200 hover:border-brand-400 hover:text-brand-300"
                  }`}
                >
                  Começar agora
                </Link>
              )}
            </div>
          </div>
        ))}
      </section>

      <section className="border-t border-ink-800 bg-ink-900/30 py-12">
        <div className="mx-auto max-w-3xl px-5 text-center">
          <h2 className="text-xl font-semibold text-white">Perguntas frequentes</h2>
          <div className="mt-8 space-y-6 text-left text-sm">
            <div>
              <h3 className="font-semibold text-slate-100">Preciso de cartão pra começar?</h3>
              <p className="mt-1 text-slate-400">
                Não. O trial de 7 dias é totalmente gratuito e não pede cartão. Você só decide pagar se quiser continuar depois.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-100">Posso trocar de plano depois?</h3>
              <p className="mt-1 text-slate-400">
                Sim, a qualquer momento. Upgrade vale imediatamente; downgrade entra no próximo ciclo.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-100">E se eu cancelar?</h3>
              <p className="mt-1 text-slate-400">
                O cancelamento é imediato. O serviço continua disponível até o fim do ciclo já pago, e você pode exportar todos os dados.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-100">Meus dados estão seguros?</h3>
              <p className="mt-1 text-slate-400">
                Criptografia em trânsito (TLS 1.3), provedores SOC 2/ISO 27001, conformidade LGPD. Veja a{" "}
                <Link href="/privacidade" className="text-cyan-300 underline-offset-2 hover:underline">Política de Privacidade</Link>.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-800 bg-ink-950">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-6 text-xs text-slate-600 sm:flex-row">
          <p>© {new Date().getFullYear()} ENDURANCE</p>
          <div className="flex gap-5">
            <Link href="/privacidade" className="hover:text-slate-300">Privacidade</Link>
            <Link href="/termos" className="hover:text-slate-300">Termos</Link>
            <Link href="/precos" className="hover:text-slate-300">Preços</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
