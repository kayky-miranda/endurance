import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/endurance/permissions";
import { allSuppliersForExport } from "@/lib/endurance/suppliers";
import { formatCnpj } from "@/lib/endurance/cnpj";

// Escapa um campo para CSV (separador ";", padrão BR para o Excel).
const cell = (v: string | number) => {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const session = await getSession();
  if (!session || session.slug !== slug)
    return new NextResponse("Não autorizado.", { status: 401 });
  if (!hasPermission(session.role, session.permissions, "suppliers.manage"))
    return new NextResponse("Acesso restrito.", { status: 403 });

  const suppliers = await allSuppliersForExport(session.org);

  const header = [
    "Nome",
    "Razão social",
    "Nome fantasia",
    "CNPJ",
    "Inscrição estadual",
    "Cidade",
    "UF",
    "CEP",
    "Telefone",
    "E-mail",
    "Prazo pagamento (dias)",
    "Prazo entrega (dias)",
    "Limite de crédito",
    "Avaliação",
    "Status",
    "Pedidos",
    "Produtos vinculados",
  ];
  const lines = suppliers.map((s) =>
    [
      s.name,
      s.razaoSocial,
      s.nomeFantasia,
      s.cnpj ? formatCnpj(s.cnpj) : "",
      s.ie,
      s.city,
      s.state,
      s.zip,
      s.phone,
      s.email,
      s.paymentTermDays,
      s.leadTimeDays,
      Number(s.creditLimit).toFixed(2).replace(".", ","),
      s.rating,
      s.status === "ativo" ? "Ativo" : "Inativo",
      s._count.orders,
      s._count.productLinks,
    ]
      .map(cell)
      .join(";"),
  );
  // BOM para o Excel reconhecer UTF-8 (acentos).
  const csv = "﻿" + [header.join(";"), ...lines].join("\r\n");

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fornecedores-${slug}-${today}.csv"`,
    },
  });
}
