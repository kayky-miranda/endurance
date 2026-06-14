import { prisma } from "@/lib/db";
import { money } from "@/lib/endurance/money";
import { sessionHasPermission } from "@/lib/auth";
import CodigoBarrasClient from "../codigo-barras-client";
import { loadModule, DeniedModule, ModuleHeader } from "../module-kit";

// Código de barras — geração de códigos e impressão de etiquetas.
export default async function CodigoBarrasPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { mod, session, denied } = await loadModule(slug, "codigo_barras");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;

  const rows = session
    ? await prisma.product.findMany({
        where: { organizationId: session.org },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const products = rows.map((p) => ({
    id: p.id,
    name: p.name,
    price: money(p.price),
    category: p.category,
    barcode: p.barcode,
    stock: p.stock,
  }));
  const canManage = session
    ? sessionHasPermission(session, "products.manage")
    : false;

  return (
    <div className="space-y-6">
      <ModuleHeader slug={slug} label={mod.label} description={mod.description} />
      <CodigoBarrasClient slug={slug} products={products} canManage={canManage} />
    </div>
  );
}
