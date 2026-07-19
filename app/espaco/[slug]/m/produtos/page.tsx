import { prisma } from "@/lib/db";
import { money } from "@/lib/endurance/money";
import ProductsClient, { type Product } from "../products-client";
import { loadModule, DeniedModule, ModuleHeader } from "../module-kit";

// Cadastro de produtos — catálogo com preço, custo e categorias.
const PAGE_SIZE = 100;

export default async function ProdutosPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; pagina?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { mod, session, denied } = await loadModule(slug, "produtos");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;

  // Busca e paginação no banco — catálogos grandes não podem vir inteiros.
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, parseInt(sp.pagina ?? "1", 10) || 1);
  const where = {
    organizationId: session?.org ?? "",
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { barcode: { contains: q } },
            { category: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [rows, total] = session
    ? await Promise.all([
        prisma.product.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: PAGE_SIZE,
          skip: (page - 1) * PAGE_SIZE,
        }),
        prisma.product.count({ where }),
      ])
    : [[], 0];
  const products: Product[] = rows.map((p) => ({
    id: p.id,
    name: p.name,
    barcode: p.barcode,
    category: p.category,
    ncm: p.ncm,
    unit: p.unit,
    price: money(p.price),
    stock: p.stock,
  }));

  return (
    <div className="space-y-6">
      <ModuleHeader slug={slug} label={mod.label} description={mod.description} />
      <ProductsClient
        products={products}
        pager={{ total, page, pageSize: PAGE_SIZE, q }}
      />
    </div>
  );
}
