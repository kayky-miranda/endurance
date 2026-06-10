import { notFound } from "next/navigation";
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> b07ccfa (Resolve conflitos de merge (lado HEAD) e estabiliza o build)
import { requireOrgAccess, canManageTeamSession } from "@/lib/auth";
import { getWorkspace } from "@/lib/endurance/workspace";
import { canAccessModule, type AccessRole } from "@/lib/endurance/catalog";
import {
  effectivePermissions,
  modulePermission,
} from "@/lib/endurance/permissions";
<<<<<<< HEAD
=======
import { requireOrgAccess, canManageTeam } from "@/lib/auth";
import { getWorkspace } from "@/lib/endurance/workspace";
import { canAccessModule, type AccessRole } from "@/lib/endurance/catalog";
>>>>>>> 4601ad18c1a383bb3f7086a9290822d31bf3f5fa
=======
>>>>>>> b07ccfa (Resolve conflitos de merge (lado HEAD) e estabiliza o build)
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
<<<<<<< HEAD
=======
>>>>>>> b07ccfa (Resolve conflitos de merge (lado HEAD) e estabiliza o build)
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

<<<<<<< HEAD
=======
>>>>>>> 4601ad18c1a383bb3f7086a9290822d31bf3f5fa
=======
>>>>>>> b07ccfa (Resolve conflitos de merge (lado HEAD) e estabiliza o build)
  return (
    <Shell
      orgName={ws.name}
      nicheLabel={ws.nicheLabel}
      slug={slug}
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> b07ccfa (Resolve conflitos de merge (lado HEAD) e estabiliza o build)
      modules={modules}
      userName={session.name}
      canManage={canManageTeamSession(session)}
      canViewDashboard={canViewDashboard}
<<<<<<< HEAD
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
=======
>>>>>>> b07ccfa (Resolve conflitos de merge (lado HEAD) e estabiliza o build)
    >
      {children}
    </Shell>
  );
}
