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
const PAY_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  credito: "Crédito",
  debito: "Débito",
  pix: "Pix",
};
const PAY_COLOR: Record<string, string> = {
  dinheiro: "#10b981",
  credito: "#06b6d4",
  debito: "#8b5cf6",
  pix: "#f59e0b",
};

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function SalesByDayChart({
  data,
}: {
  data: { date: string; total: number }[];
}) {
  const rows = data.map((d) => ({
    label: d.date.slice(8, 10) + "/" + d.date.slice(5, 7),
    total: d.total,
  }));
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(148,163,184,0.18)"
            vertical={false}
          />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} width={36} />
          <Tooltip
            cursor={{ fill: "rgba(148,163,184,0.1)" }}
            formatter={(v: number) => brl(v)}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.3)",
              fontSize: 12,
            }}
          />
          <Bar dataKey="total" fill="#06b6d4" radius={[4, 4, 0, 0]} maxBarSize={34} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CashflowChart({
  data,
}: {
  data: { label: string; entradas: number; saidas: number }[];
}) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={2}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(148,163,184,0.18)"
            vertical={false}
          />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} width={36} />
          <Tooltip
            cursor={{ fill: "rgba(148,163,184,0.1)" }}
            formatter={(v: number, name) => [
              brl(v),
              name === "entradas" ? "Entradas" : "Saídas",
            ]}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.3)",
              fontSize: 12,
            }}
          />
          <Bar dataKey="entradas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={18} />
          <Bar dataKey="saidas" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PaymentMixChart({
  data,
}: {
  data: { method: string; amount: number }[];
}) {
  const rows = data.map((d) => ({
    name: PAY_LABEL[d.method] ?? d.method,
    value: d.amount,
    color: PAY_COLOR[d.method] ?? "#64748b",
  }));
  if (rows.length === 0)
    return (
      <p className="py-10 text-center text-sm text-slate-400">
        Sem pagamentos no período.
      </p>
    );
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
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: r.color }}
              />
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
