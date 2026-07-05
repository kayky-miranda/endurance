"use client";

import dynamic from "next/dynamic";

/**
 * Versões lazy dos gráficos (Recharts ≈ metade do first-load das páginas de
 * relatório). `ssr: false` + import dinâmico movem a lib para um chunk
 * assíncrono carregado após a hidratação — a página pinta primeiro, o gráfico
 * chega em seguida no lugar do skeleton.
 */

function ChartSkeleton() {
  return (
    <div className="h-64 w-full animate-pulse rounded-xl bg-slate-100 dark:bg-ink-800" />
  );
}

// O compilador do next/dynamic exige as opções como objeto literal inline.
export const SalesByDayChart = dynamic(
  () => import("./reports-charts").then((m) => m.SalesByDayChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);
export const PaymentMixChart = dynamic(
  () => import("./reports-charts").then((m) => m.PaymentMixChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);
export const CashflowChart = dynamic(
  () => import("./reports-charts").then((m) => m.CashflowChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);
export const PurchasesByMonthChart = dynamic(
  () => import("./purchasing-charts").then((m) => m.PurchasesByMonthChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);
export const CategoryChart = dynamic(
  () => import("./purchasing-charts").then((m) => m.CategoryChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);
