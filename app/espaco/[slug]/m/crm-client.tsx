"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, X } from "lucide-react";
import { updateCustomerAction } from "./crm-actions";
import type { CustomerRow } from "@/lib/endurance/crm";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const SEGMENT_STYLE: Record<string, { label: string; cls: string }> = {
  novo: {
    label: "Novo",
    cls: "bg-slate-400/15 text-slate-500 dark:text-slate-400",
  },
  ativo: {
    label: "Ativo",
    cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  em_risco: {
    label: "Em risco",
    cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  inativo: {
    label: "Inativo",
    cls: "bg-red-500/15 text-red-600 dark:text-red-400",
  },
};

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100";

const labelCls =
  "mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400";

/** Tabela de clientes do CRM com edição dos dados cadastrais. */
export default function CrmCustomersTable({
  rows,
  total,
}: {
  rows: CustomerRow[];
  total: number;
}) {
  const [editing, setEditing] = useState<CustomerRow | null>(null);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900">
      <p className="px-5 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
        Clientes ({total})
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-ink-800">
              <th className="px-5 py-2.5 font-medium">Cliente</th>
              <th className="px-5 py-2.5 font-medium">Compras</th>
              <th className="px-5 py-2.5 font-medium">Total gasto</th>
              <th className="px-5 py-2.5 font-medium">Última compra</th>
              <th className="px-5 py-2.5 font-medium">Segmento</th>
              <th className="px-5 py-2.5 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const st = SEGMENT_STYLE[c.segment] ?? SEGMENT_STYLE.novo;
              return (
                <tr
                  key={c.id}
                  className="border-b border-slate-100 last:border-0 dark:border-ink-800"
                >
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-700 dark:text-slate-200">
                      {c.name}
                      {c.dueRepurchase && (
                        <span className="ml-2 rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-medium text-brand-600 dark:text-brand-300">
                          recompra
                        </span>
                      )}
                    </p>
                    {c.phone && (
                      <p className="text-xs text-slate-400">{c.phone}</p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                    {c.orders}
                  </td>
                  <td className="px-5 py-3 text-slate-700 dark:text-slate-200">
                    {brl(c.totalSpent)}
                  </td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                    {c.lastDays === null ? "—" : `há ${c.lastDays} dias`}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${st.cls}`}
                    >
                      {st.label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => setEditing(c)}
                      title="Editar dados do cliente"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-brand-500 dark:hover:bg-ink-800"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditCustomerModal
          customer={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function EditCustomerModal({
  customer,
  onClose,
}: {
  customer: CustomerRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone);
  const [email, setEmail] = useState(customer.email);
  const [document, setDocument] = useState(customer.document);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    const res = await updateCustomerAction({
      customerId: customer.id,
      name,
      phone,
      email,
      document,
    });
    setBusy(false);
    if (res.ok) {
      onClose();
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-xl dark:bg-ink-900 sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-ink-700">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-100">
            <Pencil className="h-4 w-4 text-brand-500" />
            Editar cliente
          </h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 dark:hover:bg-ink-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div>
            <label className={labelCls}>Nome *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do cliente"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Telefone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(00) 00000-0000"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente@email.com"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>CPF / CNPJ</label>
            <input
              value={document}
              onChange={(e) => setDocument(e.target.value)}
              placeholder="Documento (opcional)"
              className={inputCls}
            />
          </div>
          {error && (
            <p className="text-xs font-medium text-red-500">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-ink-700">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-ink-600 dark:text-slate-300 dark:hover:bg-ink-800"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={busy || !name.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
