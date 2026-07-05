import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getBalance, changePlan, purchaseExtras } from "@/lib/endurance/marketing/credits";
import { PLANS, planById, type PlanId } from "@/lib/endurance/marketing/plans";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const balance = await getBalance(session.org);
  return NextResponse.json({ balance, plans: PLANS });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action: string = body.action ?? "";

  if (action === "change_plan") {
    const planId = body.planId as PlanId;
    if (!planById(planId)) {
      return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
    }
    const balance = await changePlan(session.org, planId);
    return NextResponse.json({ balance });
  }

  if (action === "buy_extra") {
    const qty = Number(body.qty ?? 1);
    if (qty < 1 || qty > 50) {
      return NextResponse.json({ error: "Quantidade inválida." }, { status: 400 });
    }
    await purchaseExtras(session.org, qty, `extra_purchase_${qty}`);
    const balance = await getBalance(session.org);
    return NextResponse.json({ balance });
  }

  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}
