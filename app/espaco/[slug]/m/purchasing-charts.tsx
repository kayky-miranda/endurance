"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const axisTick = { fill: "#94a3b8", fontSize: 11 };
const CAT_COLORS = [
  "#06b6d4", "#8b5cf6", "#10b981", "#f59e0b", "#f43f5e", "#64748b",
];

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function PurchasesByMonthChart({
  data,
}: {
  data: { label: string; total: number }[];
}) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(148,163,184,0.18)"
            vertical={false}
          />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} width={44} />
          <Tooltip
            cursor={{ fill: "rgba(148,163,184,0.1)" }}
            formatter={(v: number) => brl(v)}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.3)",
              fontSize: 12,
            }}
          />
          <Bar dataKey="total" fill="#06b6d4" radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryChart({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  if (data.length === 0)
    return (
      <p className="py-10 text-center text-sm text-slate-400">
        Sem compras com categoria no período.
      </p>
    );
  const rows = data.map((d, i) => ({ ...d, color: CAT_COLORS[i % CAT_COLORS.length] }));
  return (
    <>
      <div className="h-[160px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="value"
              nameKey="name"
              innerRadius={42}
              outerRadius={66}
              paddingAngle={3}
              stroke="none"
            >
              {rows.map((r) => (
                <Cell key={r.name} fill={r.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number) => brl(v)}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid rgba(148,163,184,0.3)",
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 space-y-1.5">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: r.color }} />
              {r.name}
            </span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {brl(r.value)}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
