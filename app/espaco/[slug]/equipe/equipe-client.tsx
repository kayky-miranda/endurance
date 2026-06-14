"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  UserPlus,
  Trash2,
  AlertCircle,
  User,
  Mail,
  Lock,
  Phone,
  Briefcase,
  Search,
  ShieldCheck,
  Lock as LockIcon,
  Unlock,
  Pencil,
  X,
  Clock,
  History,
  Users,
  CircleCheck,
  CircleSlash,
  ChevronDown,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  RefreshCw,
  LayoutDashboard,
  ScanLine,
  Package,
  Boxes,
  Truck,
  FileText,
  Wallet,
  Download,
  UserCog,
  CreditCard,
  Settings,
  ShoppingCart,
  Banknote,
  Plug,
  Zap,
  SlidersHorizontal,
  ListFilter,
  IdCard,
  Plus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  createUserAction,
  updateUserAction,
  setUserStatusAction,
  removeUserAction,
  resetPasswordAction,
} from "./equipe-actions";

export type MemberView = {
  id: string;
  name: string;
  email: string;
  phone: string;
  jobTitle: string;
  role: string;
  profile: string;
  permissions: string[];
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
};

export type ActivityView = {
  id: string;
  actorName: string;
  action: string;
  detail: string;
  createdAt: string;
};

type PermissionDef = { id: string; label: string; description: string; group: string };
type ProfileDef = {
  id: string;
  label: string;
  description: string;
  baseRole: string;
  permissions: string[];
};

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Dono",
  ADMIN: "Administrador",
  MEMBER: "Membro",
};

const ACTION_LABEL: Record<string, string> = {
  "user.create": "Criou usuário",
  "user.update": "Editou permissões",
  "user.block": "Bloqueou usuário",
  "user.unblock": "Desbloqueou usuário",
  "user.delete": "Removeu usuário",
  "user.reset_password": "Redefiniu senha",
  // Fiscal
  "nfce.emit": "Emitiu NFC-e",
  "nfce.cancel": "Cancelou NFC-e",
  "nfe.emit": "Emitiu NF-e",
  "nfe.cancel": "Cancelou NF-e",
  "fiscal.config_save": "Configuração fiscal",
  "invoice.import": "Importou notas",
  // Financeiro
  "finance.entry_create": "Criou lançamento",
  "finance.entry_paid": "Baixa financeira",
  "cash.open": "Abriu o caixa",
  "cash.movement": "Movimentou o caixa",
  "cash.close": "Fechou o caixa",
  // Estoque
  "product.create": "Cadastrou produto",
  "product.delete": "Removeu produto",
  "stock.adjust": "Ajustou estoque",
  "supplier.create": "Cadastrou fornecedor",
  "purchase.create": "Criou pedido de compra",
  "purchase.sent": "Enviou pedido de compra",
  "purchase.receive": "Recebeu pedido de compra",
  "barcode.generate": "Gerou código de barras",
  "barcode.set": "Definiu código de barras",
  "data.import": "Importação em massa",
};

// Ícone por perfil pré-configurado (para o dropdown de perfil).
const PROFILE_ICON: Record<string, LucideIcon> = {
  administrador: ShieldCheck,
  gerente: UserCog,
  financeiro: Wallet,
  estoque: Boxes,
  caixa: Banknote,
  vendedor: ShoppingCart,
  operador: User,
};

// Ícone por grupo de permissões.
const GROUP_ICON: Record<string, LucideIcon> = {
  Operação: Zap,
  "Catálogo & Estoque": Boxes,
  "Fiscal & Financeiro": Wallet,
  Administração: Settings,
};

// Ícone por permissão (facilita a identificação visual).
const PERMISSION_ICON: Record<string, LucideIcon> = {
  "dashboard.view": LayoutDashboard,
  "pdv.sell": ScanLine,
  "customers.manage": Users,
  "products.manage": Package,
  "stock.manage": Boxes,
  "suppliers.manage": Truck,
  "fiscal.manage": FileText,
  "finance.reports": Wallet,
  "reports.export": Download,
  "team.manage": UserCog,
  "integrations.config": Plug,
  "subscription.manage": CreditCard,
  "settings.general": Settings,
};

// Cargos sugeridos (agrupados) — o dropdown é pesquisável e aceita valor livre.
const CARGO_PRESETS: { value: string; group: string }[] = [
  { value: "Proprietário(a)", group: "Gestão" },
  { value: "Gerente", group: "Gestão" },
  { value: "Gerente de loja", group: "Gestão" },
  { value: "Supervisor(a)", group: "Gestão" },
  { value: "Operador(a) de Caixa", group: "Operação" },
  { value: "Vendedor(a)", group: "Operação" },
  { value: "Repositor(a)", group: "Operação" },
  { value: "Estoquista", group: "Operação" },
  { value: "Financeiro", group: "Administrativo" },
  { value: "Auxiliar Administrativo", group: "Administrativo" },
  { value: "Contador(a)", group: "Administrativo" },
];

function fmtDateTime(iso: string | null): string {
  if (!iso) return "Nunca acessou";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EquipeClient({
  slug,
  currentUserId,
  members,
  activity,
  permissions,
  permissionGroups,
  profiles,
}: {
  slug: string;
  currentUserId: string;
  members: MemberView[];
  activity: ActivityView[];
  permissions: PermissionDef[];
  permissionGroups: string[];
  profiles: ProfileDef[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"users" | "audit">("users");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "blocked">("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<MemberView | null>(null);
  const [resetting, setResetting] = useState<MemberView | null>(null);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const cargos = useMemo(
    () =>
      Array.from(new Set(members.map((m) => m.jobTitle).filter(Boolean))).sort(),
    [members],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (roleFilter !== "all" && m.jobTitle !== roleFilter) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.jobTitle.toLowerCase().includes(q)
      );
    });
  }, [members, query, statusFilter, roleFilter]);

  const stats = useMemo(() => {
    const active = members.filter((m) => m.status === "active").length;
    return { total: members.length, active, blocked: members.length - active };
  }, [members]);

  async function toggleStatus(m: MemberView) {
    setBusyId(m.id);
    setError("");
    try {
      const res = await setUserStatusAction(
        m.id,
        m.status === "active" ? "blocked" : "active",
      );
      if (res.ok) router.refresh();
      else setError(res.error);
    } finally {
      setBusyId("");
    }
  }

  async function remove(m: MemberView) {
    if (!confirm(`Remover ${m.name}? Esta ação não pode ser desfeita.`)) return;
    setBusyId(m.id);
    setError("");
    try {
      const res = await removeUserAction(m.id);
      if (res.ok) router.refresh();
      else setError(res.error);
    } finally {
      setBusyId("");
    }
  }

  return (
    <div>
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestão de Usuários</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Crie usuários da sua empresa e defina permissões por perfil (RBAC).
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setError("");
            setShowCreate(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-brand-400"
        >
          <UserPlus className="h-4 w-4" />
          Novo usuário
        </button>
      </div>

      {/* Cards de estatística */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <StatCard icon={Users} label="Total de usuários" value={stats.total} tone="brand" />
        <StatCard icon={CircleCheck} label="Ativos" value={stats.active} tone="emerald" />
        <StatCard icon={CircleSlash} label="Bloqueados" value={stats.blocked} tone="red" />
      </div>

      {/* Abas */}
      <div className="mt-6 flex gap-1 border-b border-slate-200 dark:border-ink-700">
        <TabBtn active={tab === "users"} onClick={() => setTab("users")} icon={Users}>
          Usuários
        </TabBtn>
        <TabBtn active={tab === "audit"} onClick={() => setTab("audit")} icon={History}>
          Auditoria
        </TabBtn>
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {tab === "users" ? (
        <div className="mt-5">
          {/* Busca e filtros */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome, e-mail ou cargo…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
              />
            </div>
            <div className="w-full sm:w-52">
              <Combobox
                value={roleFilter}
                onChange={setRoleFilter}
                leadingIcon={Briefcase}
                searchable={cargos.length > 4}
                searchPlaceholder="Buscar cargo…"
                placeholder="Todos os cargos"
                options={[
                  { value: "all", label: "Todos os cargos", icon: Briefcase },
                  ...cargos.map((c) => ({ value: c, label: c, icon: IdCard })),
                ]}
              />
            </div>
            <div className="w-full sm:w-44">
              <Combobox
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as typeof statusFilter)}
                leadingIcon={ListFilter}
                placeholder="Todos os status"
                options={[
                  { value: "all", label: "Todos os status", icon: ListFilter },
                  { value: "active", label: "Ativos", icon: CircleCheck },
                  { value: "blocked", label: "Bloqueados", icon: CircleSlash },
                ]}
              />
            </div>
          </div>

          {/* Lista */}
          <div className="mt-4 space-y-2.5">
            {filtered.length === 0 && (
              <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500 dark:border-ink-700">
                Nenhum usuário encontrado com esses filtros.
              </p>
            )}
            {filtered.map((m) => (
              <UserRow
                key={m.id}
                m={m}
                isCurrent={m.id === currentUserId}
                busy={busyId === m.id}
                profiles={profiles}
                onEdit={() => {
                  setError("");
                  setEditing(m);
                }}
                onResetPassword={() => {
                  setError("");
                  setResetting(m);
                }}
                onToggleStatus={() => toggleStatus(m)}
                onRemove={() => remove(m)}
              />
            ))}
          </div>
        </div>
      ) : (
        <AuditList activity={activity} />
      )}

      {showCreate && (
        <UserModal
          mode="create"
          slug={slug}
          permissions={permissions}
          permissionGroups={permissionGroups}
          profiles={profiles}
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            router.refresh();
          }}
        />
      )}
      {editing && (
        <UserModal
          mode="edit"
          slug={slug}
          member={editing}
          permissions={permissions}
          permissionGroups={permissionGroups}
          profiles={profiles}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
      {resetting && (
        <ResetPasswordModal
          member={resetting}
          onClose={() => setResetting(null)}
          onSaved={() => {
            setResetting(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Linha de usuário
// --------------------------------------------------------------------------
function UserRow({
  m,
  isCurrent,
  busy,
  profiles,
  onEdit,
  onResetPassword,
  onToggleStatus,
  onRemove,
}: {
  m: MemberView;
  isCurrent: boolean;
  busy: boolean;
  profiles: ProfileDef[];
  onEdit: () => void;
  onResetPassword: () => void;
  onToggleStatus: () => void;
  onRemove: () => void;
}) {
  const isOwner = m.role === "OWNER";
  const profileLabel =
    profiles.find((p) => p.id === m.profile)?.label ??
    (isOwner ? "Administrador" : "Personalizado");
  const blocked = m.status === "blocked";
  const initial = (m.name || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-ink-700 dark:bg-ink-900">
      <div
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold ${
          blocked
            ? "bg-slate-200 text-slate-400 dark:bg-ink-800"
            : "bg-brand-500 text-ink-950"
        }`}
      >
        {initial}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            {m.name}
          </p>
          {isCurrent && <span className="text-xs text-slate-400">(você)</span>}
        </div>
        <p className="truncate text-xs text-slate-500">
          {m.email}
          {m.phone ? ` · ${m.phone}` : ""}
        </p>
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-400">
          <Clock className="h-3 w-3" />
          Último acesso: {fmtDateTime(m.lastLoginAt)}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1.5">
        {m.jobTitle && (
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {m.jobTitle}
          </span>
        )}
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-brand-500/15 px-2.5 py-0.5 text-[11px] font-medium text-brand-600 dark:text-brand-200">
            {profileLabel}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
              blocked
                ? "bg-red-500/15 text-red-500 dark:text-red-300"
                : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
            }`}
          >
            {blocked ? "Bloqueado" : "Ativo"}
          </span>
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-1.5">
        {!isOwner && (
          <>
            <IconBtn title="Editar permissões" onClick={onEdit} disabled={busy}>
              <Pencil className="h-4 w-4" />
            </IconBtn>
            <IconBtn
              title="Redefinir senha"
              onClick={onResetPassword}
              disabled={busy}
            >
              <KeyRound className="h-4 w-4" />
            </IconBtn>
            {!isCurrent && (
              <IconBtn
                title={blocked ? "Desbloquear" : "Bloquear"}
                onClick={onToggleStatus}
                disabled={busy}
                tone={blocked ? "emerald" : "amber"}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : blocked ? (
                  <Unlock className="h-4 w-4" />
                ) : (
                  <LockIcon className="h-4 w-4" />
                )}
              </IconBtn>
            )}
            {!isCurrent && (
              <IconBtn title="Remover" onClick={onRemove} disabled={busy} tone="red">
                <Trash2 className="h-4 w-4" />
              </IconBtn>
            )}
          </>
        )}
        {isOwner && isCurrent && (
          <IconBtn title="Redefinir minha senha" onClick={onResetPassword} disabled={busy}>
            <KeyRound className="h-4 w-4" />
          </IconBtn>
        )}
        {isOwner && (
          <span className="flex items-center gap-1 rounded-lg bg-beacon-500/15 px-2.5 py-1 text-[11px] font-medium text-beacon-600 dark:text-beacon-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            {ROLE_LABEL[m.role]}
          </span>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Modal de criação / edição
// --------------------------------------------------------------------------
function UserModal({
  mode,
  member,
  permissions,
  permissionGroups,
  profiles,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  slug: string;
  member?: MemberView;
  permissions: PermissionDef[];
  permissionGroups: string[];
  profiles: ProfileDef[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(member?.name ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [jobTitle, setJobTitle] = useState(member?.jobTitle ?? "");
  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState(member?.profile ?? "");
  const [perms, setPerms] = useState<Set<string>>(
    new Set(member?.permissions ?? []),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function applyProfile(id: string) {
    setProfile(id);
    const def = profiles.find((p) => p.id === id);
    if (def) setPerms(new Set(def.permissions));
  }

  function toggle(id: string) {
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setProfile(""); // tornou-se personalizado
  }

  function groupIds(group: string): string[] {
    return permissions.filter((p) => p.group === group).map((p) => p.id);
  }
  function groupAllOn(group: string): boolean {
    return groupIds(group).every((id) => perms.has(id));
  }
  function toggleGroup(group: string) {
    const ids = groupIds(group);
    const allOn = ids.every((id) => perms.has(id));
    setPerms((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (allOn) next.delete(id);
        else next.add(id);
      }
      return next;
    });
    setProfile("");
  }
  function setAll(on: boolean) {
    setPerms(on ? new Set(permissions.map((p) => p.id)) : new Set());
    setProfile("");
  }

  const profileOptions: ComboOption[] = [
    ...profiles.map((p) => ({
      value: p.id,
      label: p.label,
      description: p.description,
      icon: PROFILE_ICON[p.id] ?? User,
    })),
    {
      value: "",
      label: "Personalizado",
      description: "Defina as permissões manualmente",
      icon: SlidersHorizontal,
    },
  ];
  const cargoOptions: ComboOption[] = CARGO_PRESETS.map((c) => ({
    value: c.value,
    label: c.value,
    group: c.group,
    icon: IdCard,
  }));

  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const permissions = Array.from(perms);
      const res =
        mode === "create"
          ? await createUserAction({
              name,
              email,
              phone,
              jobTitle,
              password,
              profile,
              permissions,
            })
          : await updateUserAction({
              userId: member!.id,
              phone,
              jobTitle,
              profile,
              permissions,
            });
      if (res.ok) onSaved();
      else setError(res.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl dark:bg-ink-900 sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-ink-700">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            {mode === "create" ? "Novo usuário" : `Editar ${member?.name}`}
          </h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 dark:hover:bg-ink-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {/* Dados do usuário */}
          <section>
            <SectionHeader icon={IdCard} title="Dados do usuário" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                icon={User}
                placeholder="Nome completo"
                value={name}
                onChange={setName}
                disabled={mode === "edit"}
              />
              <Field
                icon={Mail}
                type="email"
                placeholder="E-mail"
                value={email}
                onChange={setEmail}
                disabled={mode === "edit"}
              />
              <Field
                icon={Phone}
                placeholder="Telefone"
                value={phone}
                onChange={setPhone}
              />
              <Combobox
                value={jobTitle}
                onChange={setJobTitle}
                options={cargoOptions}
                leadingIcon={Briefcase}
                searchable
                allowCustom
                placeholder="Cargo"
                searchPlaceholder="Buscar ou digitar cargo…"
                emptyText="Digite para criar um cargo."
              />
              {mode === "create" && (
                <Field
                  icon={Lock}
                  type="password"
                  placeholder="Senha de acesso (mín. 6)"
                  value={password}
                  onChange={setPassword}
                />
              )}
            </div>
          </section>

          {/* Acesso e permissões */}
          <section>
            <SectionHeader
              icon={SlidersHorizontal}
              title="Acesso e permissões"
              hint="Escolha um perfil pronto ou ajuste permissão a permissão."
            />

            <label className="mb-1.5 block text-xs font-medium text-slate-500">
              Perfil de acesso
            </label>
            <Combobox
              value={profile}
              onChange={(id) => (id ? applyProfile(id) : setProfile(""))}
              options={profileOptions}
              leadingIcon={profile ? undefined : SlidersHorizontal}
              placeholder="Personalizado"
              searchable
              searchPlaceholder="Buscar perfil…"
            />

            {/* Permissões granulares */}
            <div className="mt-4 flex items-center justify-between">
              <label className="text-xs font-medium text-slate-500">
                Permissões
                <span className="ml-1.5 rounded-full bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand-600 dark:text-brand-200">
                  {perms.size}/{permissions.length}
                </span>
              </label>
              <div className="flex items-center gap-3 text-[11px] font-medium">
                <button
                  type="button"
                  onClick={() => setAll(true)}
                  className="text-brand-600 transition hover:text-brand-500 dark:text-brand-300"
                >
                  Marcar todas
                </button>
                <span className="text-slate-300 dark:text-ink-600">·</span>
                <button
                  type="button"
                  onClick={() => setAll(false)}
                  className="text-slate-500 transition hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Limpar
                </button>
              </div>
            </div>

            <div className="mt-2 space-y-3">
              {permissionGroups.map((group) => {
                const GroupIcon = GROUP_ICON[group] ?? SlidersHorizontal;
                const allOn = groupAllOn(group);
                return (
                  <div
                    key={group}
                    className="overflow-hidden rounded-xl border border-slate-200 dark:border-ink-700"
                  >
                    <div className="flex items-center justify-between bg-slate-50 px-3 py-2 dark:bg-ink-950/50">
                      <div className="flex items-center gap-2">
                        <GroupIcon className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          {group}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleGroup(group)}
                        className="text-[11px] font-medium text-brand-600 transition hover:text-brand-500 dark:text-brand-300"
                      >
                        {allOn ? "Desmarcar grupo" : "Marcar grupo"}
                      </button>
                    </div>
                    <div className="grid gap-2 p-2 sm:grid-cols-2">
                      {permissions
                        .filter((p) => p.group === group)
                        .map((p) => {
                          const on = perms.has(p.id);
                          const PIcon = PERMISSION_ICON[p.id] ?? CircleCheck;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => toggle(p.id)}
                              className={`flex items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left transition ${
                                on
                                  ? "border-brand-500/60 bg-brand-500/5"
                                  : "border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-ink-700 dark:hover:bg-ink-800/50"
                              }`}
                            >
                              <span
                                className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border transition ${
                                  on
                                    ? "border-brand-500 bg-brand-500 text-ink-950"
                                    : "border-slate-300 dark:border-ink-600"
                                }`}
                              >
                                {on && (
                                  <Check className="h-3 w-3" strokeWidth={3} />
                                )}
                              </span>
                              <PIcon
                                className={`mt-0.5 h-4 w-4 shrink-0 ${
                                  on ? "text-brand-500" : "text-slate-400"
                                }`}
                              />
                              <span className="min-w-0">
                                <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
                                  {p.label}
                                </span>
                                <span className="block text-[11px] leading-snug text-slate-500">
                                  {p.description}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-ink-700">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-ink-800"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-brand-400 disabled:opacity-40"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "create" ? "Criar usuário" : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Modal de redefinição de senha
// --------------------------------------------------------------------------
function genPassword(): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 12; i++) out += chars[arr[i] % chars.length];
  return out;
}

function ResetPasswordModal({
  member,
  onClose,
  onSaved,
}: {
  member: MemberView;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  function generate() {
    setPassword(genPassword());
    setShow(true);
    setError("");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard indisponível — ignora */
    }
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await resetPasswordAction(member.id, password);
      if (res.ok) {
        setDone(true);
        setShow(true);
      } else {
        setError(res.error);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-xl dark:bg-ink-900 sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-ink-700">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-100">
            <KeyRound className="h-4 w-4 text-brand-500" />
            Redefinir senha
          </h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 dark:hover:bg-ink-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Defina uma nova senha de acesso para{" "}
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {member.name}
            </span>
            . Anote e compartilhe com a pessoa por um canal seguro.
          </p>

          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setDone(false);
              }}
              placeholder="Nova senha (mín. 6)"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-20 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                title={show ? "Ocultar" : "Mostrar"}
                className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition hover:text-brand-500"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={copy}
                disabled={!password}
                title="Copiar"
                className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition hover:text-brand-500 disabled:opacity-30"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={generate}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 transition hover:text-brand-500 dark:text-brand-300"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Gerar senha forte
          </button>

          {done && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-300">
              <CircleCheck className="h-4 w-4 shrink-0" />
              Senha redefinida. Copie e envie para o usuário.
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-ink-700">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-ink-800"
          >
            {done ? "Fechar" : "Cancelar"}
          </button>
          {done ? (
            <button
              onClick={onSaved}
              className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-brand-400"
            >
              Concluir
            </button>
          ) : (
            <button
              onClick={save}
              disabled={busy || password.length < 6}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-brand-400 disabled:opacity-40"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Redefinir senha
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Auditoria
// --------------------------------------------------------------------------
function AuditList({ activity }: { activity: ActivityView[] }) {
  return (
    <div className="mt-5">
      <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
        Histórico das últimas {activity.length} ações na gestão de usuários.
      </p>
      {activity.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500 dark:border-ink-700">
          Nenhuma atividade registrada ainda.
        </p>
      ) : (
        <ol className="relative space-y-1 border-l border-slate-200 pl-5 dark:border-ink-700">
          {activity.map((a) => (
            <li key={a.id} className="relative py-2">
              <span className="absolute -left-[23px] top-3.5 h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-white dark:ring-ink-900" />
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className="text-sm text-slate-800 dark:text-slate-100">
                  <span className="font-medium">{a.actorName || "Sistema"}</span>{" "}
                  <span className="text-slate-500">
                    · {ACTION_LABEL[a.action] ?? a.action}
                  </span>
                </p>
                <time className="text-[11px] text-slate-400">
                  {fmtDateTime(a.createdAt)}
                </time>
              </div>
              {a.detail && (
                <p className="text-xs text-slate-500 dark:text-slate-400">{a.detail}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Primitivos de UI
// --------------------------------------------------------------------------
function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  tone: "brand" | "emerald" | "red";
}) {
  const tones: Record<string, string> = {
    brand: "bg-brand-500/15 text-brand-600 dark:text-brand-300",
    emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
    red: "bg-red-500/15 text-red-500 dark:text-red-300",
  };
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 dark:border-ink-700 dark:bg-ink-900">
      <div className={`grid h-10 w-10 place-items-center rounded-xl ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Users;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
        active
          ? "border-brand-500 text-brand-600 dark:text-brand-300"
          : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

// --------------------------------------------------------------------------
// Combobox: dropdown moderno, pesquisável, agrupado, com ícones e teclado.
// Substitui os <select> nativos por uma experiência alinhada ao restante do
// sistema (foco, seleção e hover bem destacados; opção de valor livre).
// --------------------------------------------------------------------------
type ComboOption = {
  value: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  group?: string;
};

function Combobox({
  value,
  onChange,
  options,
  placeholder = "Selecione…",
  searchable = false,
  searchPlaceholder = "Buscar…",
  allowCustom = false,
  leadingIcon,
  emptyText = "Nada encontrado.",
}: {
  value: string;
  onChange: (v: string) => void;
  options: ComboOption[];
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  allowCustom?: boolean;
  leadingIcon?: LucideIcon;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function toggleOpen() {
    setOpen((o) => {
      const next = !o;
      if (next && rootRef.current) {
        const rect = rootRef.current.getBoundingClientRect();
        // Abre para cima se houver pouco espaço abaixo (evita corte no modal).
        setDropUp(window.innerHeight - rect.bottom < 300);
      }
      return next;
    });
  }

  const selected = options.find((o) => o.value === value);
  const LeadIcon = leadingIcon ?? selected?.icon;
  const hasCustomValue = allowCustom && value && !selected;
  const display = selected?.label ?? (hasCustomValue ? value : "");

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node))
        setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open && searchable) inputRef.current?.focus();
    if (!open) setQ("");
  }, [open, searchable]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(needle) ||
        o.description?.toLowerCase().includes(needle),
    );
  }, [options, q]);

  const groups = useMemo(() => {
    const map = new Map<string, ComboOption[]>();
    for (const o of filtered) {
      const g = o.group ?? "";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(o);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const trimmed = q.trim();
  const showCreate =
    allowCustom &&
    trimmed.length > 0 &&
    !options.some((o) => o.value.toLowerCase() === trimmed.toLowerCase());

  function choose(v: string) {
    onChange(v);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        className={`flex w-full items-center gap-2 rounded-xl border bg-slate-50 px-3 py-2.5 text-left text-sm outline-none transition dark:bg-ink-950 ${
          open
            ? "border-brand-500 ring-2 ring-brand-500/30"
            : "border-slate-200 hover:border-slate-300 dark:border-ink-600 dark:hover:border-ink-500"
        }`}
      >
        {LeadIcon && (
          <LeadIcon className="h-4 w-4 shrink-0 text-slate-400" />
        )}
        <span
          className={`flex-1 truncate ${
            display
              ? "text-slate-800 dark:text-slate-100"
              : "text-slate-400 dark:text-slate-500"
          }`}
        >
          {display || placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          className={`absolute z-50 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-ink-700 dark:bg-ink-900 ${
            dropUp ? "bottom-full mb-1.5" : "mt-1.5"
          }`}
        >
          {searchable && (
            <div className="border-b border-slate-100 p-2 dark:border-ink-800">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={searchPlaceholder}
                  autoComplete="off"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-brand-500 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
                />
              </div>
            </div>
          )}
          <div className="max-h-60 overflow-y-auto p-1.5">
            {groups.map(([g, opts]) => (
              <div key={g || "_"} className="mb-1 last:mb-0">
                {g && (
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {g}
                  </p>
                )}
                {opts.map((o) => {
                  const OptIcon = o.icon;
                  const on = o.value === value;
                  return (
                    <button
                      key={o.value || "_empty"}
                      type="button"
                      onClick={() => choose(o.value)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition ${
                        on
                          ? "bg-brand-500/10 text-brand-700 dark:text-brand-200"
                          : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-ink-800"
                      }`}
                    >
                      {OptIcon && (
                        <OptIcon
                          className={`h-4 w-4 shrink-0 ${
                            on ? "text-brand-500" : "text-slate-400"
                          }`}
                        />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {o.label}
                        </span>
                        {o.description && (
                          <span className="block truncate text-[11px] text-slate-400">
                            {o.description}
                          </span>
                        )}
                      </span>
                      {on && (
                        <Check className="h-4 w-4 shrink-0 text-brand-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}

            {showCreate && (
              <button
                type="button"
                onClick={() => choose(trimmed)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm text-brand-600 transition hover:bg-brand-500/10 dark:text-brand-300"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  Usar “<span className="font-medium">{trimmed}</span>”
                </span>
              </button>
            )}

            {filtered.length === 0 && !showCreate && (
              <p className="px-2 py-6 text-center text-sm text-slate-400">
                {emptyText}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function IconBtn({
  title,
  onClick,
  disabled,
  tone = "slate",
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "slate" | "red" | "amber" | "emerald";
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    slate: "hover:border-brand-500 hover:text-brand-500",
    red: "hover:border-red-500/60 hover:text-red-500",
    amber: "hover:border-amber-500/60 hover:text-amber-500",
    emerald: "hover:border-emerald-500/60 hover:text-emerald-500",
  };
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-400 transition disabled:opacity-40 dark:border-ink-600 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-brand-500/15 text-brand-500">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {title}
        </h3>
      </div>
      {hint && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      )}
    </div>
  );
}

function Field({
  icon: Icon,
  type = "text",
  placeholder,
  value,
  onChange,
  disabled,
}: {
  icon: typeof User;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100 dark:placeholder:text-slate-500"
      />
    </div>
  );
}
