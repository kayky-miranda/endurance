import { redirect } from "next/navigation";
import { Wrench } from "lucide-react";
import { loadModule, DeniedModule, ModuleHeader } from "../module-kit";

/**
 * Fallback dos módulos SEM rota própria (rotas estáticas em m/* têm
 * precedência sobre este segmento dinâmico). Cobre o redirect do módulo
 * "acesso" e o placeholder dos módulos ainda não construídos.
 */
export default async function ModulePage({
  params,
}: {
  params: Promise<{ slug: string; moduleId: string }>;
}) {
  const { slug, moduleId } = await params;
  const { mod, denied } = await loadModule(slug, moduleId);

  // "Acesso & multiusuário" é a Gestão de Usuários — vive em /equipe
  // (que aplica o próprio gate de team.manage).
  if (moduleId === "acesso") redirect(`/espaco/${slug}/equipe`);

  if (denied) return <DeniedModule slug={slug} mod={mod} />;

  return (
    <div className="space-y-6">
      <ModuleHeader slug={slug} label={mod.label} description={mod.description} />
      <div className="grid place-items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-ink-700 dark:bg-ink-900">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-500/10 text-brand-500">
          <Wrench className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-800 dark:text-slate-100">
          Em construção
        </h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
          As telas do módulo <strong>{mod.label}</strong> entram nas próximas
          etapas. Ele já está ativo no seu espaço e com os dados isolados por
          empresa.
        </p>
      </div>
    </div>
  );
}
