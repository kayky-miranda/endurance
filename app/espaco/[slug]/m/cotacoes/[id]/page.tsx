import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getQuotationDetail } from "@/lib/endurance/quotations";
import { quotationStatusLabel } from "@/lib/endurance/quotation-status";
import QuotationDetailClient from "../../quotation-detail-client";
import { loadModule, DeniedModule } from "../../module-kit";

// Comparativo de uma cotação (matriz itens × fornecedores + ranking + vencedor).
export default async function CotacaoDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const { mod, session, denied } = await loadModule(slug, "cotacoes");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;
  if (!session) notFound();

  const detail = await getQuotationDetail(session.org, id);
  if (!detail) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/espaco/${slug}/m/cotacoes`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-brand-500 dark:text-slate-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Cotações
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">
            Cotação {detail.number}
          </h1>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500 dark:bg-ink-800 dark:text-slate-400">
            {quotationStatusLabel(detail.status)}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Preencha os preços de cada fornecedor e escolha a melhor proposta. As
          marcações destacam o menor preço, o menor prazo e a melhor avaliação.
        </p>
      </div>

      <QuotationDetailClient slug={slug} detail={detail} />
    </div>
  );
}
