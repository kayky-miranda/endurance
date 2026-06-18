import { requireOrgAccess } from "@/lib/auth";
import ContaClient from "./conta-client";

export default async function MinhaContaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await requireOrgAccess(slug);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Minha conta</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Seus dados pessoais e privacidade. Aqui você pode exportar tudo que temos sobre você e encerrar a conta a qualquer momento.
        </p>
      </header>

      <ContaClient
        name={session.name}
        email={session.email}
        role={session.role}
        emailVerified={session.emailVerified ?? false}
      />
    </div>
  );
}
