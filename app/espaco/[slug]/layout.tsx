import { notFound } from "next/navigation";
import { requireOrgAccess, canManageTeamSession } from "@/lib/auth";
import { getWorkspace } from "@/lib/endurance/workspace";
import {
  effectivePermissions,
  modulePermission,
} from "@/lib/endurance/permissions";
import { resolveTheme, themeToCss } from "@/lib/theme";
import { modulePlanFeature, planAllows } from "@/lib/endurance/billing";
import { resolvePlanContext } from "@/lib/endurance/plan-limits";
import Shell from "./shell";
import AiMeter from "./ai-meter";

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

  // O plano é resolvido UMA vez para toda a navegação (o gate por módulo em
  // loadModule repete a checagem na página, mas ali é por request de rota).
  const planCtx = await resolvePlanContext(session.org);

  // Módulo sem permissão SOME (o perfil não pode resolver isso sozinho).
  // Módulo sem plano FICA, com cadeado: é vitrine de upgrade — esconder faria o
  // cliente nunca descobrir o que ganharia ao subir de plano.
  const modules = ws.modules
    .filter((m) => {
      const required = modulePermission(m.id);
      return required ? perms.has(required) : true;
    })
    .map((m) => {
      const feature = modulePlanFeature(m.id);
      const locked =
        !!feature &&
        !planAllows(planCtx.plan, feature, {
          legacyFullAccess: planCtx.legacyFullAccess,
        });
      return { id: m.id, label: m.label, core: m.core, locked };
    });

  return (
    <>
      {/* Override das CSS vars do globals.css com a paleta da org. */}
      <style dangerouslySetInnerHTML={{ __html: themeCss }} />
      <Shell
        orgName={ws.name}
        nicheLabel={ws.nicheLabel}
        slug={slug}
        modules={modules}
        aiMeter={<AiMeter slug={slug} orgId={session.org} />}
        userName={session.name}
        userEmail={session.email}
        emailVerified={session.emailVerified ?? false}
        canManage={canManageTeamSession(session)}
        canManageBilling={perms.has("subscription.manage")}
        canViewDashboard={canViewDashboard}
        logoDataUrl={theme.logoDataUrl}
      >
        {children}
      </Shell>
    </>
  );
}
