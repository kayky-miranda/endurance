import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOrgAccess, canManageTeam } from "@/lib/auth";
import EquipeClient from "./equipe-client";

export default async function EquipePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await requireOrgAccess(slug);
  if (!canManageTeam(session.role)) redirect(`/espaco/${slug}`);

  const members = await prisma.user.findMany({
    where: { organizationId: session.org },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Equipe</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Adicione pessoas para acessarem o espaço. Cada uma entra com o próprio
        e-mail e senha.
      </p>

      <EquipeClient
        slug={slug}
        currentUserId={session.sub}
        members={members}
      />
    </div>
  );
}
