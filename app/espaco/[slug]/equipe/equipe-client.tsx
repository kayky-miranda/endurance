"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  UserPlus,
  Trash2,
  AlertCircle,
  User,
  Mail,
  Lock,
} from "lucide-react";
import { addMemberAction, removeMemberAction } from "@/app/actions";

type Member = { id: string; name: string; email: string; role: string };

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Dono",
  ADMIN: "Administrador",
  MEMBER: "Membro",
};

export default function EquipeClient({
  slug,
  currentUserId,
  members,
}: {
  slug: string;
  currentUserId: string;
  members: Member[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"MEMBER" | "ADMIN">("MEMBER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState("");

  async function add() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await addMemberAction({ name, email, password, role });
      if (res.ok) {
        setName("");
        setEmail("");
        setPassword("");
        setRole("MEMBER");
        router.refresh();
      } else {
        setError(res.error);
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setRemovingId(id);
    setError("");
    try {
      const res = await removeMemberAction(id);
      if (res.ok) router.refresh();
      else setError(res.error);
    } finally {
      setRemovingId("");
    }
  }

  return (
    <div className="mt-8 space-y-8">
      {/* Adicionar membro */}
      <section className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-100">
          <UserPlus className="h-4 w-4 text-brand-500 dark:text-brand-300" />
          Adicionar pessoa
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field icon={User} placeholder="Nome" value={name} onChange={setName} />
          <Field
            icon={Mail}
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={setEmail}
          />
          <Field
            icon={Lock}
            type="password"
            placeholder="Senha (mín. 6)"
            value={password}
            onChange={setPassword}
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "MEMBER" | "ADMIN")}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
          >
            <option value="MEMBER">Membro (acesso ao espaço)</option>
            <option value="ADMIN">Administrador (também gerencia a equipe)</option>
          </select>
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={add}
          disabled={busy}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-brand-400 disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          {busy ? "Adicionando…" : "Adicionar à equipe"}
        </button>
      </section>

      {/* Lista de membros */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-slate-500 dark:text-slate-400">
          {members.length} pessoa(s) no espaço
        </h2>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-ink-700 dark:bg-ink-900">
          {members.map((m, i) => (
            <div
              key={m.id}
              className={`flex items-center justify-between gap-3 px-4 py-3 ${
                i > 0 ? "border-t border-slate-100 dark:border-ink-800" : ""
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                  {m.name}
                  {m.id === currentUserId && (
                    <span className="ml-2 text-xs text-slate-500">(você)</span>
                  )}
                </p>
                <p className="truncate text-xs text-slate-500">{m.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs ${
                    m.role === "OWNER"
                      ? "bg-beacon-500/15 text-beacon-300"
                      : m.role === "ADMIN"
                        ? "bg-brand-500/15 text-brand-600 dark:text-brand-200"
                        : "bg-slate-100 text-slate-500 dark:bg-ink-800 dark:text-slate-400"
                  }`}
                >
                  {ROLE_LABEL[m.role] ?? m.role}
                </span>
                {m.role !== "OWNER" && m.id !== currentUserId && (
                  <button
                    type="button"
                    onClick={() => remove(m.id)}
                    disabled={removingId === m.id}
                    title="Remover"
                    className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-500/60 hover:text-red-400 disabled:opacity-40 dark:border-ink-600"
                  >
                    {removingId === m.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Field({
  icon: Icon,
  type = "text",
  placeholder,
  value,
  onChange,
}: {
  icon: typeof User;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100 dark:placeholder:text-slate-500"
      />
    </div>
  );
}
