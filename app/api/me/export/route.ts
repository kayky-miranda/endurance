import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Exportação LGPD (art. 18, II): titular pode obter cópia dos dados pessoais.
 *
 * Devolve JSON com todos os dados PESSOAIS do titular (não os dados da org —
 * estes pertencem ao controlador). Inclui:
 *   - Perfil (sem hash de senha — não é dado pessoal nesse sentido)
 *   - E-mails de verificação solicitados (metadados, sem tokens)
 *   - Logs de atividade executados PELO usuário
 *   - Vendas operadas pelo usuário (referências)
 *   - Histórico de login (lastLoginAt)
 *
 * Empacotado num único JSON em vez de ZIP — simplifica e o navegador
 * baixa em "salvar como". 5 exportações por dia, suficiente.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  if (!(await hit(`lgpd:export:${session.sub}`, 5, 24 * 60 * 60_000)).ok)
    return NextResponse.json(
      { error: "Limite diário de exportações atingido." },
      { status: 429 },
    );

  const userId = session.sub;

  const [user, verifyTokens, activities, sales] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
        name: true,
        phone: true,
        jobTitle: true,
        role: true,
        profile: true,
        permissions: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
    }),
    prisma.emailVerifyToken.findMany({
      where: { userId },
      select: { email: true, expiresAt: true, usedAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.activityLog.findMany({
      where: { actorId: userId },
      select: { action: true, detail: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.sale.findMany({
      where: { userId },
      select: { id: true, total: true, itemsCount: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
  ]);

  logger.info("Exportação LGPD solicitada", { userId });

  const payload = {
    meta: {
      schema: "endurance-lgpd-export@1",
      generatedAt: new Date().toISOString(),
      titular: { id: userId, email: session.email },
      observacao:
        "Este arquivo contém os dados PESSOAIS do titular (você). Dados operacionais da organização (clientes, fornecedores, produtos) pertencem ao controlador e não estão incluídos aqui.",
    },
    perfil: user,
    historicoVerificacaoEmail: verifyTokens,
    atividades: activities,
    vendasOperadas: sales.map((s) => ({
      ...s,
      total: s.total.toString(), // Decimal → string para JSON
    })),
  };

  const json = JSON.stringify(payload, null, 2);
  const filename = `endurance-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;

  return new Response(json, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
