import Link from "next/link";
import { Check, Circle, ArrowRight, Sparkles } from "lucide-react";
import { prisma } from "@/lib/db";

interface ChecklistItem {
  done: boolean;
  title: string;
  description: string;
  href: string;
}

/**
 * Checklist de primeiros passos. Render server-side com queries leves
 * (apenas counts). Some quando tudo está pronto — não cansa o usuário
 * veterano. Mostra progresso N/M no header.
 *
 * Atualiza a cada navegação ao dashboard. Se a UI precisar reagir mais
 * rápido (ex.: cadastrou produto), use revalidatePath após a ação.
 */
export default async function OnboardingChecklist({
  orgId,
  slug,
  emailVerified,
}: {
  orgId: string;
  slug: string;
  emailVerified: boolean;
}) {
  const [hasBrandKit, userCount, productCount, saleCount] = await Promise.all([
    prisma.brandKit.findUnique({ where: { organizationId: orgId }, select: { id: true } }),
    prisma.user.count({
      where: { organizationId: orgId, status: { notIn: ["blocked", "deleted"] } },
    }),
    prisma.product.count({ where: { organizationId: orgId } }),
    prisma.sale.count({ where: { organizationId: orgId } }),
  ]);

  const base = `/espaco/${slug}`;
  const items: ChecklistItem[] = [
    {
      done: emailVerified,
      title: "Confirme seu e-mail",
      description: "Libera emissão fiscal e troca de plano.",
      href: `${base}/conta`,
    },
    {
      done: !!hasBrandKit,
      title: "Personalize a identidade visual",
      description: "Cores, fontes e logo aparecem em recibos e marketing.",
      href: `${base}/m/marketing`,
    },
    {
      done: productCount > 0,
      title: "Cadastre seu primeiro produto",
      description: "Sem produto, não tem venda.",
      href: `${base}/m/produtos`,
    },
    {
      done: userCount > 1,
      title: "Convide sua equipe",
      description: "Cada usuário recebe um link mágico por e-mail.",
      href: `${base}/equipe`,
    },
    {
      done: saleCount > 0,
      title: "Registre a primeira venda",
      description: "Use o PDV para experimentar o fluxo completo.",
      href: `${base}/m/pdv`,
    },
  ];

  const doneCount = items.filter((i) => i.done).length;
  // Se tudo está pronto, não polui o dashboard.
  if (doneCount === items.length) return null;

  return (
    <section className="rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-white p-5 dark:border-cyan-900/40 dark:from-cyan-950/40 dark:to-ink-900">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            Próximos passos
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-200 dark:bg-ink-700">
            <div
              className="h-full rounded-full bg-cyan-500"
              style={{ width: `${(doneCount / items.length) * 100}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {doneCount}/{items.length}
          </span>
        </div>
      </header>

      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.title}>
            <Link
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 transition ${
                item.done
                  ? "text-slate-400 hover:bg-white/40 dark:hover:bg-ink-800/40"
                  : "hover:bg-white dark:hover:bg-ink-800"
              }`}
            >
              {item.done ? (
                <Check className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium ${
                    item.done
                      ? "text-slate-400 line-through dark:text-slate-500"
                      : "text-slate-800 dark:text-slate-100"
                  }`}
                >
                  {item.title}
                </p>
                {!item.done && (
                  <p className="text-xs text-slate-500">{item.description}</p>
                )}
              </div>
              {!item.done && (
                <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
