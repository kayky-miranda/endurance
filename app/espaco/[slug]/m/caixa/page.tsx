import { getCaixaOverview } from "@/lib/endurance/cash";
import CaixaClient from "../caixa-client";
import {
  loadModule,
  DeniedModule,
  ModuleHeader,
  EmptyCard,
} from "../module-kit";

// Fechamento de caixa — turno do PDV (abertura, sangria/suprimento, conferência).
export default async function CaixaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { mod, session, denied } = await loadModule(slug, "caixa");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;

  const overview = session
    ? await getCaixaOverview(session.org, session.sub, session.role)
    : null;

  return (
    <div className="space-y-6">
      <ModuleHeader slug={slug} label={mod.label} description={mod.description} />
      {!overview ? (
        <EmptyCard>Sessão expirada.</EmptyCard>
      ) : (
        <CaixaClient overview={overview} />
      )}
    </div>
  );
}
