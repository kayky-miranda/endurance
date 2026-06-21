import { requireOrgAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ContaClient from "./conta-client";
import SecuritySection from "./security-section";

export default async function MinhaContaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await requireOrgAccess(slug);

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { totpEnabledAt: true },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Minha conta</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Seus dados pessoais, segurança e privacidade.
        </p>
      </header>

      <ContaClient
        name={session.name}
        email={session.email}
        role={session.role}
        emailVerified={session.emailVerified ?? false}
      />

      <SecuritySection totpEnabled={!!user?.totpEnabledAt} />
    </div>
  );
}
