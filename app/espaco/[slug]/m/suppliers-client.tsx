"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Search,
  Trash2,
  Pencil,
  Loader2,
  AlertCircle,
  X,
  Truck,
  Star,
  Download,
  Building2,
  History,
} from "lucide-react";
import Pager from "./pager";
import type { PageMeta } from "@/lib/endurance/pagination";
import type {
  SupplierRow,
  SupplierDetail,
  SupplierContactRow,
} from "@/lib/endurance/suppliers";
import {
  createSupplierAction,
  updateSupplierAction,
  deleteSupplierAction,
  addSupplierContactAction,
  removeSupplierContactAction,
  loadSupplierAction,
} from "./suppliers-actions";
import { lookupCnpjAction } from "./lookup-actions";

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100";
const labelCls = "mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type HistRow = { action: string; detail: string; actor: string; at: string };
type FormState = Partial<SupplierDetail>;

const empty: FormState = {
  name: "",
  razaoSocial: "",
  nomeFantasia: "",
  cnpj: "",
  ie: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  country: "Brasil",
  phone: "",
  email: "",
  paymentTermDays: 0,
  leadTimeDays: 0,
  creditLimit: 0,
  rating: 0,
  status: "ativo",
  note: "",
};

export default function SuppliersClient({
  slug,
  rows,
  meta,
  q,
  status,
}: {
  slug: string;
  rows: SupplierRow[];
  meta: PageMeta;
  q: string;
  status: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const [term, setTerm] = useState(q);
  const [drawer, setDrawer] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [contacts, setContacts] = useState<SupplierContactRow[]>([]);
  const [history, setHistory] = useState<HistRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState("");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Busca: vive na URL (a consulta roda no servidor), com debounce de 350ms.
  useEffect(() => setTerm(q), [q]);
  function onSearch(value: string) {
    setTerm(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => updateQuery({ q: value, pagina: "" }), 350);
  }
  function updateQuery(patch: Record<string, string>) {
    const params = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function openCreate() {
    setEditId(null);
    setForm(empty);
    setContacts([]);
    setHistory([]);
    setError("");
    setDrawer(true);
  }

  async function openEdit(id: string) {
    setEditId(id);
    setForm(empty);
    setContacts([]);
    setHistory([]);
    setError("");
    setDrawer(true);
    const res = await loadSupplierAction(id);
    if (res.ok && res.detail) {
      setForm(res.detail);
      setContacts(res.detail.contacts);
      setHistory(res.history ?? []);
    } else {
      setError(res.error ?? "Não foi possível carregar o fornecedor.");
    }
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    const res = editId
      ? await updateSupplierAction(editId, form as never)
      : await createSupplierAction(form as never);
    setBusy(false);
    if (res.ok) {
      // Após criar, reabre em modo edição para permitir cadastrar contatos.
      if (!editId && "id" in res && res.id) {
        setEditId(res.id as string);
        router.refresh();
      } else {
        setDrawer(false);
        router.refresh();
      }
    } else {
      setError(res.error ?? "Erro ao salvar.");
    }
  }

  async function remove(id: string) {
    if (!confirm("Excluir este fornecedor? Esta ação não pode ser desfeita."))
      return;
    setPendingId(id);
    const res = await deleteSupplierAction(id);
    setPendingId("");
    if (res.ok) router.refresh();
    else alert(res.error);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar: busca + filtro + ações */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={term}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Buscar por nome ou CNPJ…"
            className={`${inputCls} pl-9`}
           aria-label="Buscar por nome ou CNPJ" />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 p-0.5 dark:border-ink-600">
            {[
              { id: "", label: "Todos" },
              { id: "ativo", label: "Ativos" },
              { id: "inativo", label: "Inativos" },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => updateQuery({ status: s.id, pagina: "" })}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  status === s.id
                    ? "bg-brand-500 text-ink-950"
                    : "text-slate-500 hover:text-brand-500"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <a
            href={`/espaco/${slug}/m/fornecedores/export`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600 dark:text-slate-300"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Excel</span>
          </a>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-semibold text-ink-950 transition hover:bg-brand-400"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Novo fornecedor</span>
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900">
        {rows.length === 0 ? (
          <div className="grid place-items-center px-6 py-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/10 text-brand-500">
              <Truck className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
              {q || status ? "Nenhum fornecedor encontrado" : "Nenhum fornecedor ainda"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {q || status
                ? "Ajuste a busca ou os filtros."
                : "Cadastre o primeiro fornecedor para começar."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-ink-800">
                  <th className="px-5 py-2.5 font-medium">Fornecedor</th>
                  <th className="px-5 py-2.5 font-medium">Local</th>
                  <th className="px-5 py-2.5 font-medium">Contato</th>
                  <th className="px-5 py-2.5 font-medium">Prazo pgto.</th>
                  <th className="px-5 py-2.5 font-medium">Entrega</th>
                  <th className="px-5 py-2.5 font-medium">Avaliação</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const pending = pendingId === r.id;
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 dark:border-ink-800 dark:hover:bg-ink-800/40"
                    >
                      <td className="px-5 py-3">
                        <button
                          onClick={() => openEdit(r.id)}
                          className="text-left font-medium text-slate-700 hover:text-brand-500 dark:text-slate-200"
                        >
                          {r.name}
                        </button>
                        {r.cnpj && (
                          <p className="font-mono text-xs text-slate-400">
                            {r.cnpj}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                        {[r.city, r.state].filter(Boolean).join(" / ") || "—"}
                      </td>
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                        <div className="truncate">{r.email || r.phone || "—"}</div>
                      </td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                        {r.paymentTermDays ? `${r.paymentTermDays}d` : "—"}
                      </td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                        {r.leadTimeDays ? `${r.leadTimeDays}d` : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <Stars value={r.rating} />
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEdit(r.id)}
                            className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600"
                            aria-label="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => remove(r.id)}
                            disabled={pending}
                            className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-500/60 hover:text-red-500 disabled:opacity-40 dark:border-ink-600"
                            aria-label="Excluir"
                          >
                            {pending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pager param="pagina" meta={meta} />

      {drawer && (
        <SupplierDrawer
          editId={editId}
          form={form}
          set={set}
          contacts={contacts}
          setContacts={setContacts}
          history={history}
          busy={busy}
          error={error}
          onClose={() => {
            setDrawer(false);
            router.refresh();
          }}
          onSave={save}
        />
      )}
    </div>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5" title={`${value} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i <= Math.round(value)
              ? "fill-amber-400 text-amber-400"
              : "text-slate-300 dark:text-ink-600"
          }`}
        />
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const active = status === "ativo";
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
        active
          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          : "bg-slate-400/15 text-slate-500"
      }`}
    >
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

function SupplierDrawer({
  editId,
  form,
  set,
  contacts,
  setContacts,
  history,
  busy,
  error,
  onClose,
  onSave,
}: {
  editId: string | null;
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  contacts: SupplierContactRow[];
  setContacts: (c: SupplierContactRow[]) => void;
  history: HistRow[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: () => void;
}) {
  const [looking, setLooking] = useState(false);
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);

  async function fillFromCnpj() {
    setLookupMsg(null);
    setLooking(true);
    const res = await lookupCnpjAction(form.cnpj ?? "");
    setLooking(false);
    if (!res.ok) {
      setLookupMsg(res.error);
      return;
    }
    const d = res.data;
    // Preenche cadastro e endereço; nome de exibição/contato só se vazios.
    set("razaoSocial", d.razaoSocial);
    if (d.nomeFantasia) set("nomeFantasia", d.nomeFantasia);
    if (!form.name?.trim()) set("name", d.nomeFantasia || d.razaoSocial);
    if (d.address) set("address", d.address);
    if (d.city) set("city", d.city);
    if (d.state) set("state", d.state);
    if (d.zip) set("zip", d.zip);
    if (d.email && !form.email?.trim()) set("email", d.email);
    if (d.phone && !form.phone?.trim()) set("phone", d.phone);
    setLookupMsg(
      d.situacao && d.situacao.toUpperCase() !== "ATIVA"
        ? `Atenção: situação cadastral na Receita é "${d.situacao}".`
        : "Dados preenchidos a partir da Receita.",
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-2xl dark:bg-ink-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-ink-800">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500/10 text-brand-500">
              <Building2 className="h-5 w-5" />
            </div>
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              {editId ? "Editar fornecedor" : "Novo fornecedor"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {/* Dados gerais */}
          <Section title="Dados gerais">
            <Field label="Nome de exibição *" className="sm:col-span-2">
              <input
                className={inputCls}
                value={form.name ?? ""}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Como o fornecedor aparece nas listas" />
            </Field>
            <Field label="Razão social">
              <input
                className={inputCls}
                value={form.razaoSocial ?? ""}
                onChange={(e) => set("razaoSocial", e.target.value)}
              />
            </Field>
            <Field label="Nome fantasia">
              <input
                className={inputCls}
                value={form.nomeFantasia ?? ""}
                onChange={(e) => set("nomeFantasia", e.target.value)}
              />
            </Field>
            <Field label="CNPJ">
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  value={form.cnpj ?? ""}
                  onChange={(e) => set("cnpj", e.target.value)}
                  inputMode="numeric"
                  placeholder="00.000.000/0000-00" />
                <button
                  type="button"
                  onClick={fillFromCnpj}
                  disabled={looking}
                  title="Buscar dados na Receita (preenche razão social, endereço e contato)"
                  className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:border-brand-500 hover:text-brand-500 disabled:opacity-50 dark:border-ink-600 dark:text-slate-300"
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
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  {lookupMsg}
                </p>
              )}
            </Field>
            <Field label="Inscrição estadual">
              <input
                className={inputCls}
                value={form.ie ?? ""}
                onChange={(e) => set("ie", e.target.value)}
              />
            </Field>
          </Section>

          {/* Endereço */}
          <Section title="Endereço">
            <Field label="Logradouro" className="sm:col-span-2">
              <input
                className={inputCls}
                value={form.address ?? ""}
                onChange={(e) => set("address", e.target.value)}
              />
            </Field>
            <Field label="Cidade">
              <input
                className={inputCls}
                value={form.city ?? ""}
                onChange={(e) => set("city", e.target.value)}
              />
            </Field>
            <Field label="UF">
              <input
                className={inputCls}
                value={form.state ?? ""}
                onChange={(e) => set("state", e.target.value.toUpperCase())}
                maxLength={2}
              />
            </Field>
            <Field label="CEP">
              <input
                className={inputCls}
                value={form.zip ?? ""}
                onChange={(e) => set("zip", e.target.value)}
                inputMode="numeric"
              />
            </Field>
            <Field label="País">
              <input
                className={inputCls}
                value={form.country ?? ""}
                onChange={(e) => set("country", e.target.value)}
              />
            </Field>
          </Section>

          {/* Contato principal */}
          <Section title="Contato principal">
            <Field label="Telefone">
              <input
                className={inputCls}
                value={form.phone ?? ""}
                onChange={(e) => set("phone", e.target.value)}
              />
            </Field>
            <Field label="E-mail">
              <input
                className={inputCls}
                value={form.email ?? ""}
                onChange={(e) => set("email", e.target.value)}
                inputMode="email"
              />
            </Field>
          </Section>

          {/* Condições comerciais */}
          <Section title="Condições comerciais">
            <Field label="Prazo de pagamento (dias)">
              <input
                className={inputCls}
                value={String(form.paymentTermDays ?? 0)}
                onChange={(e) =>
                  set("paymentTermDays", Number(e.target.value) || 0)
                }
                inputMode="numeric"
              />
            </Field>
            <Field label="Prazo médio de entrega (dias)">
              <input
                className={inputCls}
                value={String(form.leadTimeDays ?? 0)}
                onChange={(e) => set("leadTimeDays", Number(e.target.value) || 0)}
                inputMode="numeric"
              />
            </Field>
            <Field label="Limite de crédito (R$)">
              <input
                className={inputCls}
                value={String(form.creditLimit ?? 0)}
                onChange={(e) =>
                  set("creditLimit", Number(e.target.value.replace(",", ".")) || 0)
                }
                inputMode="decimal"
              />
            </Field>
            <Field label="Avaliação (0 a 5)">
              <input
                className={inputCls}
                value={String(form.rating ?? 0)}
                onChange={(e) => set("rating", Number(e.target.value) || 0)}
                inputMode="decimal"
              />
            </Field>
            <Field label="Status">
              <select
                className={inputCls}
                value={form.status ?? "ativo"}
                onChange={(e) => set("status", e.target.value)}
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </Field>
            <Field label="Observações" className="sm:col-span-2">
              <textarea
                className={`${inputCls} min-h-16`}
                value={form.note ?? ""}
                onChange={(e) => set("note", e.target.value)}
              />
            </Field>
          </Section>

          {/* Contatos adicionais (só após salvar) */}
          {editId ? (
            <ContactsManager
              supplierId={editId}
              contacts={contacts}
              setContacts={setContacts}
            />
          ) : (
            <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-500 dark:bg-ink-950 dark:text-slate-400">
              Salve o fornecedor para adicionar contatos extras.
            </p>
          )}

          {/* Histórico de alterações */}
          {editId && history.length > 0 && (
            <Section title="Histórico de alterações" icon={History}>
              <div className="sm:col-span-2 space-y-1.5">
                {history.map((h, i) => (
                  <div key={i} className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="text-slate-700 dark:text-slate-300">
                      {h.detail}
                    </span>{" "}
                    — {h.actor || "sistema"} · {h.at}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-ink-800">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-ink-600 dark:text-slate-300 dark:hover:bg-ink-800"
          >
            Fechar
          </button>
          <button
            onClick={onSave}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-brand-400 disabled:opacity-40"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {editId ? "Salvar alterações" : "Cadastrar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ContactsManager({
  supplierId,
  contacts,
  setContacts,
}: {
  supplierId: string;
  contacts: SupplierContactRow[];
  setContacts: (c: SupplierContactRow[]) => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!name.trim() || busy) return;
    setBusy(true);
    const res = await addSupplierContactAction(supplierId, {
      name,
      role,
      phone,
      email,
    });
    setBusy(false);
    if (res.ok) {
      setContacts([
        ...contacts,
        { id: `tmp-${Date.now()}`, name, role, phone, mobile: "", email },
      ]);
      setName("");
      setRole("");
      setPhone("");
      setEmail("");
    } else {
      alert(res.error);
    }
  }

  async function remove(id: string) {
    const res = await removeSupplierContactAction(id);
    if (res.ok) setContacts(contacts.filter((c) => c.id !== id));
  }

  return (
    <Section title="Contatos">
      <div className="sm:col-span-2 space-y-2">
        {contacts.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 dark:border-ink-700"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                {c.name}
                {c.role && (
                  <span className="ml-1.5 text-xs font-normal text-slate-400">
                    {c.role}
                  </span>
                )}
              </p>
              <p className="truncate text-xs text-slate-400">
                {[c.phone, c.email].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
            <button
              onClick={() => remove(c.id)}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 hover:text-red-500"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do contato"
           aria-label="Nome do contato" />
          <input
            className={inputCls}
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Cargo (ex.: comprador)"
           aria-label="Cargo (ex.: comprador)" />
          <input
            className={inputCls}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Telefone / celular"
           aria-label="Telefone / celular" />
          <input
            className={inputCls}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail"
           aria-label="E-mail" />
        </div>
        <button
          onClick={add}
          disabled={busy || !name.trim()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-brand-500 hover:text-brand-500 disabled:opacity-40 dark:border-ink-600 dark:text-slate-300"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar contato
        </button>
      </div>
    </Section>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: typeof History;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {title}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}
