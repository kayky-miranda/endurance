import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOrgAccess, sessionHasPermission } from "@/lib/auth";
import { loadBilling } from "@/lib/endurance/billing-service";
import { PLAN_CATALOG } from "@/lib/endurance/billing";
import BillingClient from "./billing-client";

export default async function AssinaturaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await requireOrgAccess(slug);
  if (!sessionHasPermission(session, "subscription.manage"))
    redirect(`/espaco/${slug}`);

  const [{ billing, invoices }, seatsUsed] = await Promise.all([
    loadBilling(session.org),
    prisma.user.count({ where: { organizationId: session.org } }),
  ]);

  return (
    <BillingClient
      slug={slug}
      plans={PLAN_CATALOG}
      billing={billing}
      invoices={invoices}
      seatsUsed={seatsUsed}
    />
  );
}
