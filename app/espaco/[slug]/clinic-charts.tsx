"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { DayPoint, StatusSlice } from "@/lib/endurance/clinic-dashboard";
import { STATUS_LABEL } from "@/lib/endurance/scheduling";

const axisTick = { fill: "#94a3b8", fontSize: 11 };

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid rgba(148,163,184,0.3)",
  fontSize: 12,
};

const STATUS_COLOR: Record<string, string> = {
  agendado: "#94a3b8",
  confirmado: "#06b6d4",
  atendido: "#10b981",
  faltou: "#f59e0b",
  cancelado: "#f43f5e",
};

/** Consultas por dia (últimos 14 dias): agendadas x atendidas. */
export function AppointmentsByDayChart({ data }: { data: DayPoint[] }) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" vertical={false} />
          <XAxis dataKey="date" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
          <Tooltip cursor={{ fill: "rgba(148,163,184,0.1)" }} contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar name="Agendadas" dataKey="agendados" fill="#06b6d4" radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar name="Atendidas" dataKey="atendidos" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Distribuição das consultas por status no período. */
export function StatusMixChart({ data }: { data: StatusSlice[] }) {
  const rows = data.map((d) => ({
    name: STATUS_LABEL[d.status] ?? d.status,
    value: d.count,
    color: STATUS_COLOR[d.status] ?? "#94a3b8",
  }));
  if (rows.length === 0) {
    return (
      <div className="grid h-[220px] place-items-center text-sm text-slate-400">
        Sem dados no período.
      </div>
    );
  }
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={rows} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={2}>
            {rows.map((r) => (
              <Cell key={r.name} fill={r.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
