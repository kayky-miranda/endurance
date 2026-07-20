import "server-only";
import { NextResponse } from "next/server";

/**
 * Export CSV padrão do sistema: separador ";" (padrão BR/Excel), CRLF e BOM
 * UTF-8 (acentos corretos ao abrir direto no Excel). Toda rota de export usa
 * este helper para o formato ser idêntico em todos os módulos.
 */

export const csvCell = (v: string | number | null | undefined) => {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Número no formato BR (vírgula decimal), como o Excel espera. */
export const csvMoney = (n: number) => n.toFixed(2).replace(".", ",");

export function csvResponse(
  filename: string,
  header: string[],
  rows: (string | number | null | undefined)[][],
): NextResponse {
  const lines = rows.map((r) => r.map(csvCell).join(";"));
  const csv = "﻿" + [header.join(";"), ...lines].join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
