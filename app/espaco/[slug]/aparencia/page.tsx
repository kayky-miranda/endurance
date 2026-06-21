import { redirect } from "next/navigation";
import { requireOrgAccess, canManageTeamSession } from "@/lib/auth";
import { resolveTheme } from "@/lib/theme";
import AparenciaClient from "./aparencia-client";

export default async function AparenciaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await requireOrgAccess(slug);
  if (!canManageTeamSession(session)) redirect(`/espaco/${slug}`);

  const theme = await resolveTheme(session.org);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Aparência</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Personalize a identidade visual do espaço. As alterações são aplicadas para todos os usuários da empresa.
        </p>
      </header>

      <AparenciaClient
        initial={{
          presetId: theme.presetId,
          primaryColor: theme.primary,
          secondaryColor: theme.primarySoft,
          buttonTextColor: theme.buttonText,
          sidebarBgDark: theme.chrome950,
          defaultDarkMode: theme.defaultDarkMode,
          logoDataUrl: theme.logoDataUrl,
        }}
      />
    </div>
  );
}
