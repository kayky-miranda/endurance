import { prisma } from "@/lib/db";
import { money } from "@/lib/endurance/money";
import PdvClient from "../pdv-client";
import { type Product } from "../products-client";
import { loadModule, DeniedModule } from "../module-kit";

// PDV (frente de caixa) — tela cheia, sem o header padrão dos módulos.
export default async function PdvPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { mod, session, denied } = await loadModule(slug, "pdv");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;

  const rows = session
    ? await prisma.product.findMany({
        where: { organizationId: session.org },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const products: Product[] = rows.map((p) => ({
    id: p.id,
    name: p.name,
    barcode: p.barcode,
    category: p.category,
    price: money(p.price),
    stock: p.stock,
  }));

  return <PdvClient products={products} slug={slug} />;
}
