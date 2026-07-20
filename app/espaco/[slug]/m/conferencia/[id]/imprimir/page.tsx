import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/endurance/permissions";
import { getCount } from "@/lib/endurance/stock-count";
import {
  COUNT_STATUS_LABEL,
  COUNT_TYPE_LABEL,
} from "@/lib/endurance/stock-count-shared";
import PrintSheet from "./print-sheet";

// Folha de impressão da conferência (relatório limpo, sem o shell do app).
export default async function ImprimirConferenciaPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const session = await getSession();
  if (!session || session.slug !== slug) redirect("/entrar");
  if (!hasPermission(session.role, session.permissions, "count.manage"))
    redirect(`/espaco/${slug}`);

  const count = await getCount(session.org, id);
  if (!count) notFound();

  return (
    <PrintSheet
      slug={slug}
      count={count}
      typeLabel={COUNT_TYPE_LABEL[count.type as keyof typeof COUNT_TYPE_LABEL] ?? count.type}
      statusLabel={
        COUNT_STATUS_LABEL[count.status as keyof typeof COUNT_STATUS_LABEL] ??
        count.status
      }
    />
  );
}
