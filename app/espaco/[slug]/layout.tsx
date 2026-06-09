import { notFound } from "next/navigation";
import { requireOrgAccess, canManageTeam } from "@/lib/auth";
import { getWorkspace } from "@/lib/endurance/workspace";
import { canAccessModule, type AccessRole } from "@/lib/endurance/catalog";
import Shell from "./shell";

export default async function EspacoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await requireOrgAccess(slug);
  const ws = await getWorkspace(slug);
  if (!ws) notFound();

  return (
    <Shell
      orgName={ws.name}
      nicheLabel={ws.nicheLabel}
      slug={slug}
      modules={ws.modules
        .filter((m) => canAccessModule(session.role as AccessRole, m.id))
        .map((m) => ({
          id: m.id,
          label: m.label,
          core: m.core,
        }))}
      userName={session.name}
      canManage={canManageTeam(session.role)}
    >
      {children}
    </Shell>
  );
}
