import { prisma } from "@/lib/db";
import { money } from "@/lib/endurance/money";
import ProductsClient, { type Product } from "../products-client";
import { loadModule, DeniedModule, ModuleHeader } from "../module-kit";

// Cadastro de produtos — catálogo com preço, custo e categorias.
export default async function ProdutosPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { mod, session, denied } = await loadModule(slug, "produtos");
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

  return (
    <div className="space-y-6">
      <ModuleHeader slug={slug} label={mod.label} description={mod.description} />
      <ProductsClient products={products} />
    </div>
  );
}
