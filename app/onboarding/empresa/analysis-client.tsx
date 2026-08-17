"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  Check,
  Building2,
  Target,
  ListChecks,
  Boxes,
} from "lucide-react";
import { BrandMark } from "@/app/components/BrandMark";
import {
  readOperation,
  hasProfile,
  modulesForAreas,
  type OperationProfile,
} from "@/lib/endurance/operation-profile";
import type { OnboardingResult } from "@/lib/endurance/types";
import { applyOnboardingAction } from "../onboarding-actions";
import { Progress } from "../signup-client";

/**
 * ETAPA 2: a descrição livre e o que entendemos dela.
 *
 * A leitura da operação (tipo, modelo, áreas) é uma regra PURA que roda aqui
 * no cliente, sobre o texto que a pessoa acabou de escrever. Isso mantém o
 * resumo idêntico com a IA ligada ou desligada, e garante que toda afirmação
 * na tela ("modelo B2B") venha de algo que ela escreveu.
 *
 * A classificação de ramo e a escolha de módulos continuam vindo do
 * servidor, que é quem conhece o catálogo.
 */

type Fase = "escrever" | "analisando" | "resumo";

const PLACEHOLDER =
  "Ex.: Somos uma indústria de peças automotivas, trabalhamos com produção própria, temos aproximadamente 50 funcionários, atendemos outras empresas e controlamos estoque, produção, compras, vendas e logística.";

/** Perguntas que ajudam quem travou na folha em branco. Nenhuma é obrigatória. */
const GUIA = [
  "O que a empresa faz",
  "Principal segmento",
  "Produtos ou serviços oferecidos",
  "Como realiza as vendas",
  "Quantidade aproximada de funcionários",
  "Unidades ou filiais",
  "Principais processos",
  "Maiores dificuldades de gestão",
  "Sistemas usados hoje",
];

const MIN_CHARS = 30;

export default function AnalysisClient({
  slug,
  moduleLabels,
}: {
  slug: string;
  moduleLabels: Record<string, string>;
}) {
  const [salvando, setSalvando] = useState(false);
  const [fase, setFase] = useState<Fase>("escrever");
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<OperationProfile | null>(null);
  const [classificacao, setClassificacao] = useState<OnboardingResult | null>(
    null,
  );

  const curto = texto.trim().length < MIN_CHARS;

  /**
   * O que vai ser ligado de verdade: o pacote do ramo (quando a classificação
   * reconheceu um) MAIS os módulos das áreas que apareceram na descrição.
   *
   * A tela mostra exatamente esta lista, e a action grava exatamente ela. Era
   * aqui que a promessa se quebrava: o resumo listava "Produção · Estoque ·
   * Compras · Fiscal" e a empresa entrava só com os módulos core, porque o
   * ramo tinha caído em "outro" e o resto era descartado na gravação.
   */
  const modulosAtivar = [
    ...new Set([
      ...(classificacao?.suggestedModules ?? []),
      ...modulesForAreas(perfil?.areas ?? []),
    ]),
  ].filter((id) => moduleLabels[id]);

  async function analisar() {
    setErro(null);
    setFase("analisando");
    // A leitura pura sai na hora; é o que sustenta o resumo mesmo se a
    // classificação do servidor falhar.
    setPerfil(readOperation(texto));
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: texto }),
      });
      if (res.ok) setClassificacao(await res.json());
    } catch {
      // Sem classificação, o resumo ainda aparece e o cliente segue com os
      // módulos core. Travar aqui seria perder o cadastro por causa da rede.
    }
    setFase("resumo");
  }

  /**
   * Salva a configuração e entra na plataforma.
   *
   * Troca de página inteira, e não `router.push`, por dois motivos. O menu
   * lateral é montado no servidor a partir dos módulos que acabamos de ligar,
   * e uma navegação de cliente pode reaproveitar a árvore anterior. E, com
   * `router.push`, a URL só muda quando o servidor responde: enquanto a
   * próxima rota carrega, a pessoa continua vendo a tela de resumo com o
   * botão aparentemente sem efeito.
   */
  async function concluir() {
    setErro(null);
    setSalvando(true);
    const res = await applyOnboardingAction({
      niche: classificacao?.niche ?? "outro",
      segment: classificacao?.segment ?? perfil?.kind ?? "",
      moduleIds: modulosAtivar,
      description: texto,
      kind: perfil?.kind ?? "",
    });
    if (!res.ok) {
      setErro(res.error);
      setSalvando(false);
      return;
    }
    window.location.assign(`/espaco/${slug}`);
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-5 py-10 sm:py-14">
      <Link href="/" className="mb-8 flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30">
          <BrandMark className="h-6 w-6" />
        </span>
        <span className="font-semibold tracking-tight text-slate-100">
          ENDURANCE
        </span>
      </Link>

      <Progress current={2} />

      {fase === "escrever" && (
        <section className="mt-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">
            Conte um pouco sobre sua empresa
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Descreva como sua empresa funciona. A Endurance vai analisar essas
            informações para entender sua operação e ajudar a configurar a
            plataforma de acordo com suas necessidades.
          </p>

          <div className="mt-6 rounded-2xl border border-ink-700 bg-ink-900/70 p-5 sm:p-6">
            <label
              htmlFor="descricao"
              className="mb-2 block text-xs font-medium text-slate-400"
            >
              Descrição da empresa
            </label>
            <textarea
              id="descricao"
              rows={8}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={PLACEHOLDER}
              className="w-full resize-none rounded-xl border border-ink-600 bg-ink-950 px-4 py-3 text-sm leading-relaxed text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"
            />

            <p className="mt-4 text-[11px] font-semibold uppercase tracking-widest text-slate-600">
              Se ajudar, comente sobre
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {GUIA.map((g) => (
                <span
                  key={g}
                  className="rounded-full border border-ink-700 px-2.5 py-1 text-[11px] text-slate-500"
                >
                  {g}
                </span>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-slate-600">
              Escreva do seu jeito. Nada aqui é obrigatório.
            </p>
          </div>

          <div className="mt-6 flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={() => window.location.assign(`/espaco/${slug}`)}
              className="text-xs text-slate-500 transition hover:text-slate-300"
            >
              Pular por enquanto
            </button>
            <button
              type="button"
              onClick={analisar}
              disabled={curto}
              className="btn-sheen inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-ink-950 transition hover:bg-brand-400 disabled:opacity-50 sm:w-auto"
              title={
                curto
                  ? "Escreva um pouco mais para conseguirmos entender a operação."
                  : undefined
              }
            >
              Continuar <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {fase === "analisando" && (
        <section className="mt-16 flex flex-col items-center text-center">
          <Loader2 className="h-7 w-7 animate-spin text-brand-400" />
          <p className="mt-4 text-sm text-slate-300">Conhecendo sua operação</p>
          <p className="mt-1 text-xs text-slate-500">
            Levando em conta o que você descreveu.
          </p>
        </section>
      )}

      {fase === "resumo" && (
        <section className="mt-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">
            Entendemos sua operação
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Confira o que identificamos. Você pode ajustar tudo depois, dentro
            do sistema.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {perfil?.kind && (
              <Bloco icon={Building2} titulo="Segmento">
                <p className="text-sm text-slate-100">{perfil.kind}</p>
                {classificacao?.segment && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    {classificacao.segment}
                  </p>
                )}
              </Bloco>
            )}
            {perfil?.model && (
              <Bloco icon={Target} titulo="Modelo de operação">
                <p className="text-sm text-slate-100">{perfil.model}</p>
              </Bloco>
            )}
            {perfil && perfil.areas.length > 0 && (
              <Bloco icon={ListChecks} titulo="Principais áreas identificadas">
                <p className="text-sm leading-relaxed text-slate-100">
                  {perfil.areas.map((a) => a.label).join(" · ")}
                </p>
              </Bloco>
            )}
            {perfil?.needs && (
              <Bloco icon={Check} titulo="Necessidades identificadas">
                <p className="text-sm leading-relaxed text-slate-100">
                  {perfil.needs}
                </p>
              </Bloco>
            )}
            {(perfil?.headcount || perfil?.units) && (
              <Bloco icon={Building2} titulo="Estrutura">
                <p className="text-sm text-slate-100">
                  {[
                    perfil.headcount
                      ? `${perfil.headcount} pessoas`
                      : null,
                    perfil.units
                      ? `${perfil.units} ${perfil.units === 1 ? "unidade" : "unidades"}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </Bloco>
            )}
          </div>

          {/* Quando nada foi identificado, dizemos isso em vez de mostrar
              blocos vazios ou inventar um perfil. */}
          {perfil && !hasProfile(perfil) && (
            <p className="mt-6 rounded-2xl border border-ink-700 bg-ink-900/50 p-5 text-sm text-slate-400">
              Não consegui identificar detalhes suficientes na descrição. Sem
              problema: a plataforma abre com os módulos essenciais e você
              ajusta o resto nas configurações.
            </p>
          )}

          {modulosAtivar.length > 0 && (
            <div className="mt-6 rounded-2xl border border-brand-500/25 bg-brand-500/5 p-5">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-brand-300">
                <Boxes className="h-3.5 w-3.5" /> Módulos que vamos ativar
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {modulosAtivar.map((id) => (
                  <span
                    key={id}
                    className="rounded-full border border-ink-600 bg-ink-950/60 px-2.5 py-1 text-xs text-slate-300"
                  >
                    {moduleLabels[id] ?? id}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-slate-500">
                Dá para ligar e desligar módulos a qualquer momento nas
                configurações do espaço.
              </p>
            </div>
          )}

          {erro && (
            <p className="mt-5 rounded-xl border border-red-500/40 bg-red-500/5 px-3.5 py-2.5 text-sm text-red-300">
              {erro}
            </p>
          )}

          <div className="mt-7 flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={() => setFase("escrever")}
              className="text-xs text-slate-500 transition hover:text-slate-300"
            >
              Ajustar a descrição
            </button>
            <button
              type="button"
              onClick={concluir}
              disabled={salvando}
              className="btn-sheen inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-ink-950 transition hover:bg-brand-400 disabled:opacity-60 sm:w-auto"
            >
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Ir para a plataforma <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}
    </main>
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
    <div className="rounded-2xl border border-ink-700 bg-ink-900/50 p-5">
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
        <Icon className="h-3.5 w-3.5 text-brand-400" />
        {titulo}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}
