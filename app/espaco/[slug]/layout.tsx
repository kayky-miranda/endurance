import { notFound } from "next/navigation";
import { requireOrgAccess, canManageTeamSession } from "@/lib/auth";
import { getWorkspace } from "@/lib/endurance/workspace";
import {
  effectivePermissions,
  modulePermission,
} from "@/lib/endurance/permissions";
import { resolveTheme, themeToCss } from "@/lib/theme";
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

  // Tema white-label da org (cacheado por request via React cache()).
  const theme = await resolveTheme(session.org);
  const themeCss = themeToCss(theme);

  // Permissões efetivas (OWNER/ADMIN têm tudo). Fonte única do RBAC de
  // navegação: o menu só mostra módulos cuja permissão o usuário tem.
  const perms = new Set(effectivePermissions(session.role, session.permissions));
  const canViewDashboard = perms.has("dashboard.view");

  const modules = ws.modules
    .filter((m) => {
      const required = modulePermission(m.id);
      return required ? perms.has(required) : true;
    })
    .map((m) => ({ id: m.id, label: m.label, core: m.core }));

  return (
    <>
      {/* Override das CSS vars do globals.css com a paleta da org. */}
      <style dangerouslySetInnerHTML={{ __html: themeCss }} />
      <Shell
        orgName={ws.name}
        nicheLabel={ws.nicheLabel}
        slug={slug}
        modules={modules}
        userName={session.name}
        userEmail={session.email}
        emailVerified={session.emailVerified ?? false}
        canManage={canManageTeamSession(session)}
        canManageBilling={perms.has("subscription.manage")}
        canViewDashboard={canViewDashboard}
      >
        {children}
      </Shell>
    </>
  );
}
