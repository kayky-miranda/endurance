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

const WEEK = [
  { d: "Seg", vendas: 32, lucro: 12 },
  { d: "Ter", vendas: 41, lucro: 16 },
  { d: "Qua", vendas: 38, lucro: 14 },
  { d: "Qui", vendas: 52, lucro: 21 },
  { d: "Sex", vendas: 61, lucro: 26 },
  { d: "Sáb", vendas: 74, lucro: 33 },
  { d: "Dom", vendas: 29, lucro: 10 },
];

const MIX = [
  { name: "Mercearia", value: 45, color: "#06b6d4" },
  { name: "Bebidas", value: 25, color: "#8b5cf6" },
  { name: "Limpeza", value: 18, color: "#f59e0b" },
  { name: "Outros", value: 12, color: "#10b981" },
];

const axisTick = { fill: "#94a3b8", fontSize: 12 };

export default function DashboardCharts() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Vendas da semana */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-ink-700 dark:bg-ink-900 lg:col-span-2">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Vendas da semana
          </h2>
          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#06b6d4]" /> Vendas
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#8b5cf6]" /> Lucro
            </span>
          </div>
        </div>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={WEEK} barGap={6}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(148,163,184,0.18)"
                vertical={false}
              />
              <XAxis dataKey="d" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                cursor={{ fill: "rgba(148,163,184,0.1)" }}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid rgba(148,163,184,0.3)",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="vendas" fill="#06b6d4" radius={[4, 4, 0, 0]} maxBarSize={26} />
              <Bar dataKey="lucro" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Mix de vendas */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-ink-700 dark:bg-ink-900">
        <h2 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          Mix de vendas
        </h2>
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={MIX}
                dataKey="value"
                nameKey="name"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={3}
                stroke="none"
              >
                {MIX.map((m) => (
                  <Cell key={m.name} fill={m.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid rgba(148,163,184,0.3)",
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 space-y-1.5">
          {MIX.map((m) => (
            <div
              key={m.name}
              className="flex items-center justify-between text-xs"
            >
              <span className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ background: m.color }}
                />
                {m.name}
              </span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {m.value}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
