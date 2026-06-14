import ImportClient from "../import-client";
import { loadModule, DeniedModule, ModuleHeader } from "../module-kit";

// Importação em massa (CSV/Excel) com modelo, validação e relatório de erros.
export default async function ImportacaoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { mod, denied } = await loadModule(slug, "importacao");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;

  return (
    <div className="space-y-6">
      <ModuleHeader slug={slug} label={mod.label} description={mod.description} />
      <ImportClient slug={slug} />
    </div>
  );
}
