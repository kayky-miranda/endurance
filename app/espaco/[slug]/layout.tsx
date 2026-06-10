import { notFound } from "next/navigation";
import { requireOrgAccess, canManageTeamSession } from "@/lib/auth";
import { getWorkspace } from "@/lib/endurance/workspace";
import { canAccessModule, type AccessRole } from "@/lib/endurance/catalog";
import {
  effectivePermissions,
  modulePermission,
} from "@/lib/endurance/permissions";
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

  return (
    <Shell
      orgName={ws.name}
      nicheLabel={ws.nicheLabel}
      slug={slug}
      modules={modules}
      userName={session.name}
      canManage={canManageTeamSession(session)}
      canViewDashboard={canViewDashboard}
    >
      {children}
    </Shell>
  );
}
