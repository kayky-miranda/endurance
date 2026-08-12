"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CircleCheck,
  CircleAlert,
  CircleX,
  Circle,
  Loader2,
  Search,
  Save,
  ExternalLink,
} from "lucide-react";
import type { EstablishmentView } from "@/lib/endurance/establishment";
import type { StepState, StepId } from "@/lib/endurance/establishment-steps";
import { cscHelpText, sefazCscUrl } from "@/lib/endurance/sefaz-portais";
import {
  tributacaoIcms,
  validateTaxConfig,
  ORIGEM_OPTIONS,
  FINALIDADE_OPTIONS,
  PRESENCA_OPTIONS,
  CONSUMIDOR_OPTIONS,
} from "@/lib/endurance/tax-defaults";
import { lookupCnpjAction, lookupCepAction } from "../m/lookup-actions";
import {
  saveEstablishmentStepAction,
  type EditableStep,
} from "./establishment-actions";

/**
 * Assistente de cadastro do estabelecimento em 7 etapas.
 *
 * Divide-se em etapas porque o cadastro fiscal completo tem ~40 campos e boa
 * parte depende do contador — uma tela única faria o cliente desistir na
 * metade. Cada etapa grava sozinha, então dá para parar e voltar depois.
 *
 * O indicador de cada etapa vem da PRONTIDÃO FISCAL, calculada no servidor:
 * ✅ nada pendente · ⚠️ ressalva · ❌ impede emitir · ○ opcional.
 */

const STATUS_ICON = {
  completo: { Icon: CircleCheck, cls: "text-emerald-500" },
  pendente: { Icon: CircleAlert, cls: "text-amber-500" },
  bloqueado: { Icon: CircleX, cls: "text-red-500" },
  opcional: { Icon: Circle, cls: "text-slate-300 dark:text-slate-600" },
} as const;

const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100";

function Field({
  label,
  children,
  hint,
  span,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  span?: string;
}) {
  return (
    <label className={`block text-xs font-medium text-slate-500 ${span ?? ""}`}>
      {label}
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-0.5 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

export default function WizardClient({
  data,
  steps,
  percent,
  resumeAt,
  readinessPanel,
  certificatePanel,
}: {
  data: EstablishmentView;
  steps: StepState[];
  percent: number;
  resumeAt: StepId;
  /** Painéis prontos vindos do servidor (revisão e certificado). */
  readinessPanel: React.ReactNode;
  certificatePanel: React.ReactNode;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState<StepId>(resumeAt);
  const [form, setForm] = useState(data);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [badField, setBadField] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);

  const set = (k: keyof EstablishmentView, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  function save(step: EditableStep, fields: (keyof EstablishmentView)[]) {
    setMsg(null);
    setBadField(null);
    const payload = Object.fromEntries(fields.map((k) => [k, form[k] ?? ""]));
    startTransition(async () => {
      const res = await saveEstablishmentStepAction(step, payload);
      if (res.ok) {
        setMsg({ tone: "ok", text: "Etapa salva." });
        router.refresh();
      } else {
        setBadField(res.field ?? null);
        setMsg({ tone: "err", text: res.error ?? "Não foi possível salvar." });
      }
    });
  }

  /** Puxa da Receita e preenche o que veio — sem apagar o que já existe. */
  function buscarCnpj() {
    setLooking(true);
    setMsg(null);
    startTransition(async () => {
      const res = await lookupCnpjAction(form.cnpj);
      setLooking(false);
      if (!res.ok) {
        setMsg({ tone: "err", text: res.error });
        return;
      }
      const d = res.data;
      setForm((f) => ({
        ...f,
        razaoSocial: d.razaoSocial || f.razaoSocial,
        nomeFantasia: d.nomeFantasia || f.nomeFantasia,
        municipio: d.city || f.municipio,
        uf: d.state || f.uf,
        cep: d.zip || f.cep,
        cMun: d.codigoMunicipioIbge || f.cMun,
        telefone: d.phone || f.telefone,
        email: d.email || f.email,
        situacaoCadastral: d.situacao || f.situacaoCadastral,
      }));
      setMsg({
        tone: "ok",
        text: "Dados da Receita carregados. Revise e salve a etapa.",
      });
    });
  }

  function buscarCep() {
    setLooking(true);
    setMsg(null);
    startTransition(async () => {
      const res = await lookupCepAction(form.cep);
      setLooking(false);
      if (!res.ok) {
        setMsg({ tone: "err", text: res.error });
        return;
      }
      const d = res.data;
      // Logradouro e bairro SEPARADOS: a NF-e exige os dois em campos próprios.
      // Antes o bairro vinha dentro do logradouro e o campo Bairro ficava
      // vazio, seguindo como pendência que o cliente resolvia recortando texto.
      setForm((f) => ({
        ...f,
        logradouro: d.street || f.logradouro,
        bairro: d.district || f.bairro,
        municipio: d.city || f.municipio,
        uf: d.state || f.uf,
      }));
      setMsg({
        tone: "ok",
        text: "Endereço carregado. Falta o número — o CEP não traz.",
      });
    });
  }

  // A tributação é conferida na tela com a MESMA função do servidor.
  const tribIcms = tributacaoIcms(form.crt);
  const taxIssues = validateTaxConfig(
    {
      cfopPadrao: form.cfopPadrao,
      icmsOrigem: form.icmsOrigem,
      csosn: form.csosn,
      cstIcms: form.cstIcms,
      pisSituacao: form.pisSituacao,
      cofinsSituacao: form.cofinsSituacao,
      finalidade: form.finalidade,
      consumidorFinal: form.consumidorFinal,
      presencaComprador: form.presencaComprador,
    },
    form.crt,
    "65",
  );

  const etapaAtual = steps.find((s) => s.step.id === current);

  const err = (k: string) =>
    badField === k ? "border-red-500 ring-1 ring-red-500/30" : "";

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      {/* Navegação das etapas */}
      <nav aria-label="Etapas do cadastro" className="space-y-1">
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Preenchimento</span>
            <span className="font-semibold">{percent}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-ink-800">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {steps.map((s) => {
          const { Icon, cls } = STATUS_ICON[s.status];
          const active = current === s.step.id;
          return (
            <button
              key={s.step.id}
              onClick={() => setCurrent(s.step.id)}
              aria-current={active ? "step" : undefined}
              className={`flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left transition ${
                active
                  ? "bg-brand-500/10 text-brand-600 dark:text-brand-300"
                  : "hover:bg-slate-100 dark:hover:bg-ink-800"
              }`}
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cls}`} />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{s.step.label}</span>
                {s.blocking.length > 0 && (
                  <span className="block text-[11px] text-red-500">
                    {s.blocking.length}{" "}
                    {s.blocking.length === 1 ? "pendência" : "pendências"}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Conteúdo da etapa */}
      <div className="space-y-4">
        {msg && (
          <div
            role="status"
            className={`rounded-xl border px-4 py-2.5 text-sm ${
              msg.tone === "ok"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
            }`}
          >
            {msg.text}
          </div>
        )}

        {/* Pendências DA ETAPA ATUAL. Antes o menu dizia "1 pendência" e o
            cliente tinha 19 campos para adivinhar qual — só descobria indo até
            a Revisão. */}
        {etapaAtual && etapaAtual.blocking.length > 0 && (
          <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            <p className="font-medium">
              Falta preencher para conseguir emitir:
            </p>
            <ul className="mt-1 list-inside list-disc">
              {etapaAtual.blocking.map((b) => (
                <li key={b.field}>{b.label}</li>
              ))}
            </ul>
          </div>
        )}

        {current === "empresa" && (
          <Card title="Dados da empresa">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="CNPJ">
                <div className="flex gap-2">
                  <input
                    value={form.cnpj}
                    onChange={(e) => set("cnpj", e.target.value)}
                    className={`${input} ${err("cnpj")}`}
                  />
                  <button
                    type="button"
                    onClick={buscarCnpj}
                    disabled={looking || pending}
                    title="Buscar na Receita Federal"
                    className="shrink-0 rounded-xl border border-slate-200 px-3 text-slate-500 transition hover:border-brand-500 hover:text-brand-500 disabled:opacity-40 dark:border-ink-600"
                  >
                    {looking ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </Field>
              <Field label="Razão social" span="sm:col-span-2">
                <input
                  value={form.razaoSocial}
                  onChange={(e) => set("razaoSocial", e.target.value)}
                  className={input}
                />
              </Field>
              <Field label="Nome fantasia" span="sm:col-span-2">
                <input
                  value={form.nomeFantasia}
                  onChange={(e) => set("nomeFantasia", e.target.value)}
                  className={input}
                />
              </Field>
              <Field label="Situação cadastral">
                <input
                  value={form.situacaoCadastral}
                  onChange={(e) => set("situacaoCadastral", e.target.value)}
                  className={input}
                />
              </Field>
              <Field label="Inscrição Estadual" hint="Exigida para NF-e e NFC-e">
                <input
                  value={form.ie}
                  onChange={(e) => set("ie", e.target.value)}
                  className={input}
                />
              </Field>
              <Field label="Inscrição Municipal" hint="Exigida para NFS-e">
                <input
                  value={form.inscricaoMunicipal}
                  onChange={(e) => set("inscricaoMunicipal", e.target.value)}
                  className={input}
                />
              </Field>
              <Field label="Data de abertura">
                <input
                  type="date"
                  value={form.dataAbertura ?? ""}
                  onChange={(e) => set("dataAbertura", e.target.value)}
                  className={input}
                />
              </Field>
              <Field label="CNAE principal">
                <input
                  value={form.cnaePrincipal}
                  onChange={(e) => set("cnaePrincipal", e.target.value)}
                  className={input}
                />
              </Field>
              <Field label="CNAEs secundários" span="sm:col-span-2" hint="Separados por vírgula">
                <input
                  value={form.cnaeSecundarios}
                  onChange={(e) => set("cnaeSecundarios", e.target.value)}
                  className={input}
                />
              </Field>
              <Field label="Natureza jurídica" span="sm:col-span-2">
                <input
                  value={form.naturezaJuridica}
                  onChange={(e) => set("naturezaJuridica", e.target.value)}
                  className={input}
                />
              </Field>
              <Field label="Porte">
                <input
                  value={form.porte}
                  onChange={(e) => set("porte", e.target.value)}
                  className={input}
                />
              </Field>
              <Field label="E-mail">
                <input
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  className={`${input} ${err("email")}`}
                />
              </Field>
              <Field label="Telefone">
                <input
                  value={form.telefone}
                  onChange={(e) => set("telefone", e.target.value)}
                  className={input}
                />
              </Field>
              <Field label="Site">
                <input
                  value={form.site}
                  onChange={(e) => set("site", e.target.value)}
                  className={input}
                />
              </Field>
            </div>

            <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Responsável legal
            </h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              <Field label="Nome" span="sm:col-span-2">
                <input
                  value={form.respNome}
                  onChange={(e) => set("respNome", e.target.value)}
                  className={input}
                />
              </Field>
              <Field label="CPF">
                <input
                  value={form.respCpf}
                  onChange={(e) => set("respCpf", e.target.value)}
                  className={`${input} ${err("respCpf")}`}
                />
              </Field>
              <Field label="Cargo">
                <input
                  value={form.respCargo}
                  onChange={(e) => set("respCargo", e.target.value)}
                  className={input}
                />
              </Field>
              <Field label="E-mail">
                <input
                  value={form.respEmail}
                  onChange={(e) => set("respEmail", e.target.value)}
                  className={input}
                />
              </Field>
              <Field label="Telefone">
                <input
                  value={form.respTelefone}
                  onChange={(e) => set("respTelefone", e.target.value)}
                  className={input}
                />
              </Field>
            </div>

            <SaveBar
              pending={pending}
              onSave={() =>
                save("empresa", [
                  "cnpj", "razaoSocial", "nomeFantasia", "ie", "inscricaoMunicipal",
                  "cnaePrincipal", "cnaeSecundarios", "naturezaJuridica", "porte",
                  "dataAbertura", "situacaoCadastral", "email", "telefone", "site",
                  "respNome", "respCpf", "respEmail", "respTelefone", "respCargo",
                ])
              }
            />
          </Card>
        )}

        {current === "endereco" && (
          <Card title="Endereço do estabelecimento">
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="CEP">
                <div className="flex gap-2">
                  <input
                    value={form.cep}
                    onChange={(e) => set("cep", e.target.value)}
                    className={`${input} ${err("cep")}`}
                  />
                  <button
                    type="button"
                    onClick={buscarCep}
                    disabled={looking || pending}
                    title="Buscar endereço pelo CEP"
                    className="shrink-0 rounded-xl border border-slate-200 px-3 text-slate-500 transition hover:border-brand-500 hover:text-brand-500 disabled:opacity-40 dark:border-ink-600"
                  >
                    {looking ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </Field>
              <Field label="Logradouro" span="sm:col-span-2">
                <input
                  value={form.logradouro}
                  onChange={(e) => set("logradouro", e.target.value)}
                  className={input}
                />
              </Field>
              <Field label="Número">
                <input
                  value={form.numeroEnd}
                  onChange={(e) => set("numeroEnd", e.target.value)}
                  className={input}
                />
              </Field>
              <Field label="Complemento" span="sm:col-span-2">
                <input
                  value={form.complemento}
                  onChange={(e) => set("complemento", e.target.value)}
                  className={input}
                />
              </Field>
              <Field label="Bairro" span="sm:col-span-2">
                <input
                  value={form.bairro}
                  onChange={(e) => set("bairro", e.target.value)}
                  className={input}
                />
              </Field>
              <Field label="Município" span="sm:col-span-2">
                <input
                  value={form.municipio}
                  onChange={(e) => set("municipio", e.target.value)}
                  className={input}
                />
              </Field>
              <Field label="UF">
                <input
                  value={form.uf}
                  maxLength={2}
                  onChange={(e) => set("uf", e.target.value.toUpperCase())}
                  className={input}
                />
              </Field>
              <Field
                label="Código IBGE"
                hint="7 dígitos — vai no XML da nota"
              >
                <input
                  value={form.cMun}
                  onChange={(e) => set("cMun", e.target.value)}
                  className={`${input} ${err("cMun")}`}
                />
              </Field>
              <Field label="País">
                <input
                  value={form.pais}
                  onChange={(e) => set("pais", e.target.value)}
                  className={input}
                />
              </Field>
            </div>
            <SaveBar
              pending={pending}
              onSave={() =>
                save("endereco", [
                  "cep", "logradouro", "numeroEnd", "complemento", "bairro",
                  "municipio", "uf", "cMun", "pais",
                ])
              }
            />
          </Card>
        )}

        {current === "fiscal" && (
          <Card title="Dados fiscais">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Regime tributário (CRT)">
                <select
                  value={form.crt}
                  onChange={(e) => set("crt", e.target.value)}
                  className={input}
                >
                  <option value="1">1 — Simples Nacional</option>
                  <option value="2">2 — Simples Nacional, excesso de sublimite</option>
                  <option value="3">3 — Regime Normal (Presumido/Real)</option>
                </select>
              </Field>
              <Field label="Contribuinte de ICMS">
                <select
                  value={form.indicadorIe}
                  onChange={(e) => set("indicadorIe", e.target.value)}
                  className={input}
                >
                  <option value="1">1 — Contribuinte</option>
                  <option value="2">2 — Isento</option>
                  <option value="9">9 — Não contribuinte</option>
                </select>
              </Field>
            </div>

            {/* O CSC foi onde o cliente real travou na simulação: o campo pedia
                o código sem dizer o que era nem onde obter — e não se obtém
                aqui, cada SEFAZ estadual gera o dela. */}
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-ink-700 dark:bg-ink-950 dark:text-slate-300">
              <p className="font-medium">O que é o CSC?</p>
              <p className="mt-0.5">{cscHelpText(form.uf)}</p>
              {sefazCscUrl(form.uf) && (
                <a
                  href={sefazCscUrl(form.uf)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline dark:text-brand-300"
                >
                  Abrir o portal da SEFAZ-{form.uf.toUpperCase()}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="ID do CSC" hint="Só para NFC-e">
                <input
                  value={form.cscId}
                  onChange={(e) => set("cscId", e.target.value)}
                  className={input}
                />
              </Field>
              <Field label="CSC" hint="Assina o QR Code do cupom">
                <input
                  value={form.csc}
                  onChange={(e) => set("csc", e.target.value)}
                  className={input}
                />
              </Field>
              <Field
                label="NCM padrão dos produtos"
                hint="Usado quando o produto não tem NCM próprio"
              >
                <input
                  value={form.defaultNcm}
                  onChange={(e) => set("defaultNcm", e.target.value)}
                  className={`${input} ${err("defaultNcm")}`}
                />
              </Field>
            </div>
            <SaveBar
              pending={pending}
              onSave={() =>
                save("fiscal", ["crt", "indicadorIe", "cscId", "csc", "defaultNcm"])
              }
            />
          </Card>
        )}

        {current === "certificado" && certificatePanel}

        {current === "emissao" && (
          <Card title="Emissão">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Série">
                <input
                  type="number"
                  min={1}
                  value={form.serie}
                  onChange={(e) => set("serie", Number(e.target.value))}
                  className={input}
                />
              </Field>
              <Field
                label="Próximo número"
                hint="Testes em homologação também consomem numeração — ajuste aqui antes de ir para produção"
              >
                <input
                  type="number"
                  min={1}
                  value={form.proxNumero}
                  onChange={(e) => set("proxNumero", Number(e.target.value))}
                  className={input}
                />
              </Field>
              <Field
                label="Ambiente"
                hint="Homologação não tem valor fiscal — teste ali antes de produção"
              >
                <select
                  value={form.ambiente}
                  onChange={(e) => set("ambiente", e.target.value)}
                  className={input}
                >
                  <option value="2">Homologação (teste)</option>
                  <option value="1">Produção (valor fiscal)</option>
                </select>
              </Field>
              <Field label="Natureza da operação">
                <input
                  value={form.naturezaOperacao}
                  onChange={(e) => set("naturezaOperacao", e.target.value)}
                  className={input}
                />
              </Field>
            </div>

            <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Tributação padrão
            </h3>
            <p className="mt-1 text-[11px] text-slate-400">
              Códigos exigidos no XML. O ENDURANCE não calcula imposto nem
              escolhe alíquota — esses valores vêm do seu contador.
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <Field label="CFOP padrão" hint="5xxx dentro do estado, 6xxx interestadual">
                <input
                  value={form.cfopPadrao}
                  onChange={(e) => set("cfopPadrao", e.target.value)}
                  className={`${input} ${err("cfopPadrao")}`}
                />
              </Field>
              <Field label="Origem da mercadoria">
                <select
                  value={form.icmsOrigem}
                  onChange={(e) => set("icmsOrigem", e.target.value)}
                  className={input}
                >
                  {ORIGEM_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
              {/* Mostra só o código do REGIME da empresa: exibir os dois faria o
                  cliente preencher um campo que nunca vai ao XML. */}
              {tribIcms === "csosn" ? (
                <Field label="CSOSN" hint="Simples Nacional">
                  <input
                    value={form.csosn}
                    onChange={(e) => set("csosn", e.target.value)}
                    className={`${input} ${err("csosn")}`}
                  />
                </Field>
              ) : (
                <Field label="CST de ICMS" hint="Regime Normal">
                  <input
                    value={form.cstIcms}
                    onChange={(e) => set("cstIcms", e.target.value)}
                    className={`${input} ${err("cstIcms")}`}
                  />
                </Field>
              )}
              <Field label="Situação do PIS">
                <input
                  value={form.pisSituacao}
                  onChange={(e) => set("pisSituacao", e.target.value)}
                  className={input}
                />
              </Field>
              <Field label="Situação do COFINS">
                <input
                  value={form.cofinsSituacao}
                  onChange={(e) => set("cofinsSituacao", e.target.value)}
                  className={input}
                />
              </Field>
              <Field label="Finalidade">
                <select
                  value={form.finalidade}
                  onChange={(e) => set("finalidade", e.target.value)}
                  className={input}
                >
                  {FINALIDADE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Presença do comprador">
                <select
                  value={form.presencaComprador}
                  onChange={(e) => set("presencaComprador", e.target.value)}
                  className={input}
                >
                  {PRESENCA_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Consumidor final">
                <select
                  value={form.consumidorFinal}
                  onChange={(e) => set("consumidorFinal", e.target.value)}
                  className={input}
                >
                  {CONSUMIDOR_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Coerência conferida enquanto digita: o cliente vê o problema
                antes de tentar emitir e ser recusado pela SEFAZ. */}
            {taxIssues.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {taxIssues.map((i) => (
                  <li
                    key={i.field}
                    className={`text-xs ${i.blocking ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}
                  >
                    {i.blocking ? "Impede emitir: " : "Atenção: "}
                    {i.message}
                  </li>
                ))}
              </ul>
            )}
            <SaveBar
              pending={pending}
              onSave={() =>
                save("emissao", [
                  "serie", "proxNumero", "ambiente", "naturezaOperacao",
                  "cfopPadrao", "icmsOrigem", "csosn", "cstIcms",
                  "pisSituacao", "cofinsSituacao", "finalidade",
                  "consumidorFinal", "presencaComprador",
                ])
              }
            />
          </Card>
        )}

        {current === "integracoes" && (
          <Card title="Integrações fiscais">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-400">Provedor de emissão</dt>
                <dd className="font-medium text-slate-700 dark:text-slate-200">
                  {form.provider === "focusnfe" ? "Focus NFe" : "Simulada (sem provedor)"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Status</dt>
                <dd
                  className={`font-medium ${
                    form.certHabilitado
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {form.certHabilitado
                    ? "Empresa cadastrada no provedor"
                    : "Aguardando envio do certificado"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Ambiente</dt>
                <dd className="font-medium text-slate-700 dark:text-slate-200">
                  {form.ambiente === "1" ? "Produção" : "Homologação"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Certificado válido até</dt>
                <dd className="font-medium text-slate-700 dark:text-slate-200">
                  {form.certValidoAte
                    ? new Date(form.certValidoAte).toLocaleDateString("pt-BR")
                    : "—"}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              O vínculo com o provedor é criado ao enviar o certificado digital
              na etapa anterior. Não há credencial para digitar aqui.
            </p>
          </Card>
        )}

        {current === "revisao" && readinessPanel}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-900">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <Building2 className="h-4 w-4 text-brand-500" /> {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SaveBar({ pending, onSave }: { pending: boolean; onSave: () => void }) {
  return (
    <div className="mt-5 flex justify-end">
      <button
        onClick={onSave}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        Salvar etapa
      </button>
    </div>
  );
}
