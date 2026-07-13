import { notFound } from "next/navigation";
import { loadModule, DeniedModule } from "../../module-kit";
import { hasPermission } from "@/lib/endurance/permissions";
import { getCount } from "@/lib/endurance/stock-count";
import CountClient from "../count-client";

export default async function ConferenciaDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const { mod, session, denied } = await loadModule(slug, "conferencia");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;

  const count = session ? await getCount(session.org, id) : null;
  if (!count) notFound();

  const canApprove = hasPermission(
    session?.role ?? "MEMBER",
    session?.permissions,
    "count.approve",
  );

  return <CountClient slug={slug} count={count} canApprove={canApprove} />;
}
