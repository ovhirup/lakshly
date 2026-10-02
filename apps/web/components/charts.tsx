"use client";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { formatINR, formatINRCompact } from "@/lib/format";

const axis = { stroke: "var(--muted)", fontSize: 12, tickLine: false, axisLine: false } as const;
const tip = {
  contentStyle: {
    background: "var(--tooltip-bg)", border: "1px solid var(--glass-border)", borderRadius: 14,
    backdropFilter: "blur(16px)", color: "var(--text)", boxShadow: "var(--shadow)",
  },
  labelStyle: { color: "var(--muted)" },
};
const money = (v: unknown) => formatINR(Number(v));

export function Donut({ data, height = 220 }: { data: { name: string; value: number; color: string }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={2}
          cornerRadius={6} stroke="none" animationDuration={700}>
          {data.map((d) => <Cell key={d.name} fill={d.color} />)}
        </Pie>
        <Tooltip {...tip} formatter={money} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function CashflowBars({ data }: { data: { label: string; income: number; spend: number; invested: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} barGap={4}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} tickFormatter={(v) => formatINRCompact(v)} width={56} />
        <Tooltip {...tip} formatter={money} cursor={{ fill: "var(--grid)" }} />
        <Bar dataKey="income" name="Income" fill="var(--c-income)" radius={[8, 8, 0, 0]} />
        <Bar dataKey="spend" name="Spend" fill="var(--c-spend)" radius={[8, 8, 0, 0]} />
        <Bar dataKey="invested" name="Invested" fill="var(--c-invest)" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AreaTrend({ data, x, y, name, height = 220, color = "var(--accent)" }: {
  data: object[]; x: string; y: string; name: string; height?: number; color?: string;
}) {
  const id = `g-${y}-${name.replace(/\W/g, "")}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.45} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis dataKey={x} {...axis} minTickGap={24} />
        <YAxis {...axis} tickFormatter={(v) => formatINRCompact(v)} width={56} />
        <Tooltip {...tip} formatter={money} />
        <Area type="monotone" dataKey={y} name={name} stroke={color} strokeWidth={2.5} fill={`url(#${id})`} animationDuration={700} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MultiLine({ data, x, lines, height = 240 }: {
  data: object[]; x: string; lines: { key: string; name: string; color: string; dashed?: boolean }[]; height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis dataKey={x} {...axis} minTickGap={20} />
        <YAxis {...axis} tickFormatter={(v) => formatINRCompact(v)} width={60} />
        <Tooltip {...tip} formatter={money} />
        {lines.map((l) => (
          <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color} strokeWidth={2.5}
            dot={false} strokeDasharray={l.dashed ? "6 6" : undefined} animationDuration={700} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
