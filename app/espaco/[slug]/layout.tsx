import { notFound } from "next/navigation";
<<<<<<< HEAD
import { requireOrgAccess, canManageTeamSession } from "@/lib/auth";
import { getWorkspace } from "@/lib/endurance/workspace";
import { canAccessModule, type AccessRole } from "@/lib/endurance/catalog";
import {
  effectivePermissions,
  modulePermission,
} from "@/lib/endurance/permissions";
=======
import { requireOrgAccess, canManageTeam } from "@/lib/auth";
import { getWorkspace } from "@/lib/endurance/workspace";
import { canAccessModule, type AccessRole } from "@/lib/endurance/catalog";
>>>>>>> 4601ad18c1a383bb3f7086a9290822d31bf3f5fa
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

<<<<<<< HEAD
  // Permissões efetivas (OWNER/ADMIN têm tudo). Usadas para o RBAC granular
  // de navegação, por cima do gating por papel já existente.
  const perms = new Set(effectivePermissions(session.role, session.permissions));
  const canViewDashboard = perms.has("dashboard.view");

  const modules = ws.modules
    .filter((m) => {
      if (!canAccessModule(session.role as AccessRole, m.id)) return false;
      const required = modulePermission(m.id);
      return required ? perms.has(required) : true;
    })
    .map((m) => ({ id: m.id, label: m.label, core: m.core }));

=======
>>>>>>> 4601ad18c1a383bb3f7086a9290822d31bf3f5fa
  return (
    <Shell
      orgName={ws.name}
      nicheLabel={ws.nicheLabel}
      slug={slug}
<<<<<<< HEAD
      modules={modules}
      userName={session.name}
      canManage={canManageTeamSession(session)}
      canViewDashboard={canViewDashboard}
=======
      modules={ws.modules
        .filter((m) => canAccessModule(session.role as AccessRole, m.id))
        .map((m) => ({
          id: m.id,
          label: m.label,
          core: m.core,
        }))}
      userName={session.name}
      canManage={canManageTeam(session.role)}
>>>>>>> 4601ad18c1a383bb3f7086a9290822d31bf3f5fa
    >
      {children}
    </Shell>
  );
}
