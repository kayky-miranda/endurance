import { requireOrgAccess } from "@/lib/auth";
import Link from "next/link";
import { User } from "lucide-react";
import { hasPermission } from "@/lib/endurance/permissions";
import { listApiKeys } from "@/lib/endurance/api-keys";
import ConfiguracoesClient from "./configuracoes-client";
import ApiKeysSection, { type ApiKeyRow } from "./api-keys-section";

export default async function ConfiguracoesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await requireOrgAccess(slug);

  const canApi = hasPermission(session.role, session.permissions, "integrations.config");
  const apiKeys: ApiKeyRow[] = canApi
    ? (await listApiKeys(session.org)).map((k) => ({
        ...k,
        lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
        revokedAt: k.revokedAt?.toISOString() ?? null,
        createdAt: k.createdAt.toISOString(),
      }))
    : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Configurações</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Preferências de aparência e idioma da sua conta.
        </p>
      </header>

      <ConfiguracoesClient />

      {canApi && <ApiKeysSection keys={apiKeys} />}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-900">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Conta</h2>
        <p className="mt-1 text-xs text-slate-500">
          Gerencie seus dados pessoais, senha e segurança na página da conta.
        </p>
        <Link
          href={`/espaco/${slug}/conta`}
          className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-brand-400 hover:text-brand-600 dark:border-ink-600 dark:text-slate-200"
        >
          <User className="h-3.5 w-3.5" />
          Ir para Minha conta
        </Link>
      </section>
    </div>
  );
}
