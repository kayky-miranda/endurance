import { loadModule, DeniedModule, ModuleHeader } from "../module-kit";
import MarketingClient from "../marketing-client";

export default async function MarketingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { mod, denied } = await loadModule(slug, "marketing");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;

  return (
    <div className="space-y-6">
      <ModuleHeader slug={slug} label={mod.label} description={mod.description} />
      <MarketingClient />
    </div>
  );
}
