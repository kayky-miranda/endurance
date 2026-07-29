import "server-only";
import { prisma } from "@/lib/db";
import { money } from "./money";

/**
 * Busca global do topbar: encontra pacientes/clientes, produtos e consultas do
 * ESPAÇO por um termo. Estritamente escopada por organização e pelos módulos
 * ativos + permissões do usuário (o gating vem da action) — nunca vaza dados de
 * outro tenant nem de um módulo a que o perfil não tem acesso.
 */

export type SearchHitType = "paciente" | "cliente" | "produto" | "consulta";

export interface SearchHit {
  type: SearchHitType;
  label: string;
  sub: string;
  href: string;
}

export interface GlobalSearchOptions {
  slug: string;
  /** Ids dos módulos ativos no espaço. */
  modules: Set<string>;
  canCustomers: boolean;
  canProducts: boolean;
  canAgenda: boolean;
}

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const toDateInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

const PER_TYPE = 5;

export async function globalSearch(
  org: string,
  term: string,
  opts: GlobalSearchOptions,
): Promise<SearchHit[]> {
  const q = term.trim();
  if (q.length < 2) return [];

  const base = `/espaco/${opts.slug}`;
  const hasPacientes = opts.modules.has("pacientes");
  const hasCrm = opts.modules.has("crm");
  const hasProdutos = opts.modules.has("produtos");
  const hasAgenda = opts.modules.has("agenda_consultas");

  const tasks: Promise<SearchHit[]>[] = [];

  // Pacientes / clientes (mesma base Customer; o destino depende do módulo).
  if (opts.canCustomers && (hasPacientes || hasCrm)) {
    tasks.push(
      prisma.customer
        .findMany({
          where: {
            organizationId: org,
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
              { document: { contains: q } },
            ],
          },
          select: { id: true, name: true, phone: true },
          orderBy: { name: "asc" },
          take: PER_TYPE,
        })
        .then((rows) =>
          rows.map((r) => ({
            type: (hasPacientes ? "paciente" : "cliente") as SearchHitType,
            label: r.name,
            sub: r.phone || "",
            href: hasPacientes
              ? `${base}/m/pacientes/${r.id}`
              : `${base}/m/crm/${r.id}`,
          })),
        ),
    );
  }

  // Produtos.
  if (opts.canProducts && hasProdutos) {
    tasks.push(
      prisma.product
        .findMany({
          where: {
            organizationId: org,
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { sku: { contains: q, mode: "insensitive" } },
              { barcode: { contains: q } },
            ],
          },
          select: { id: true, name: true, category: true, price: true, stock: true },
          orderBy: { name: "asc" },
          take: PER_TYPE,
        })
        .then((rows) =>
          rows.map((r) => ({
            type: "produto" as SearchHitType,
            label: r.name,
            sub: `${brl(money(r.price))} · ${r.stock} em estoque`,
            href: `${base}/m/produtos?q=${encodeURIComponent(r.name)}`,
          })),
        ),
    );
  }

  // Consultas (por nome do paciente na consulta).
  if (opts.canAgenda && hasAgenda) {
    tasks.push(
      prisma.appointment
        .findMany({
          where: {
            organizationId: org,
            customerName: { contains: q, mode: "insensitive" },
          },
          select: {
            id: true,
            customerName: true,
            professional: true,
            startsAt: true,
          },
          orderBy: { startsAt: "desc" },
          take: PER_TYPE,
        })
        .then((rows) =>
          rows.map((r) => {
            const when = r.startsAt.toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            });
            return {
              type: "consulta" as SearchHitType,
              label: r.customerName || "Consulta",
              sub: [when, r.professional].filter(Boolean).join(" · "),
              href: `${base}/m/agenda_consultas?data=${toDateInput(r.startsAt)}`,
            };
          }),
        ),
    );
  }

  const grouped = await Promise.all(tasks);
  return grouped.flat();
}
