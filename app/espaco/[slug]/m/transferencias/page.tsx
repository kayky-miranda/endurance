import { prisma } from "@/lib/db";
import { activeLocations } from "@/lib/endurance/locations";
import { stockReasonLabel } from "@/lib/endurance/stock-ledger";
import TransfersClient from "../transfers-client";
import { loadModule, DeniedModule, ModuleHeader } from "../module-kit";

// Transferências de estoque entre locais (matriz, filiais, depósitos).
export default async function TransferenciasPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { mod, session, denied } = await loadModule(slug, "transferencias");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;

  const locations = session ? await activeLocations(session.org) : [];
  // Histórico: a "perna" de saída de cada transferência (refType transfer).
  const recent = session
    ? await prisma.stockMovement.findMany({
        where: { organizationId: session.org, refType: "transfer", quantity: { lt: 0 } },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          quantity: true,
          createdAt: true,
          userName: true,
          note: true,
          product: { select: { name: true } },
        },
      })
    : [];

  return (
    <div className="space-y-6">
      <ModuleHeader slug={slug} label={mod.label} description={mod.description} />
      <TransfersClient
        locations={locations}
        reasonLabel={stockReasonLabel("transferencia")}
        history={recent.map((m) => ({
          id: m.id,
          product: m.product.name,
          qty: Math.abs(m.quantity),
          when: m.createdAt.toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          user: m.userName || "Sistema",
          note: m.note,
        }))}
      />
    </div>
  );
}
