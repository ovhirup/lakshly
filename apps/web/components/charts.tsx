"use client";
import { useSyncExternalStore, useId } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { formatINR, formatINRCompact } from "@/lib/format";

const axis = { stroke: "var(--lk-text-muted)", fontSize: 12, tickLine: false, axisLine: false } as const;
// Mirrors --lk-chart-motion; Recharts takes milliseconds rather than CSS values.
const chartMotion = { animationDuration: 700, animationEasing: "spring" } as const;
function subscribeMotion(listener: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
function useChartMotion() {
  return !useSyncExternalStore(subscribeMotion, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => true);
}
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: readonly { name?: string | number; value?: string | number; color?: string; dataKey?: string | number }[]; label?: string | number }) {
  if (!active || !payload?.length) return null;
  const colors: Record<string, string> = { income: "var(--lk-income)", spend: "var(--lk-spend)", invested: "var(--lk-invest)" };
  return <div className="glass chart-tooltip"><p>{label ?? "Breakdown"}</p>{payload.map((entry, i) => <div key={`${entry.name}-${i}`}><span className="dot" style={{ background: colors[String(entry.dataKey)] ?? entry.color }} /><span>{entry.name}</span><strong>{formatINR(Number(entry.value))}</strong></div>)}</div>;
}

export function Donut({ data, height = 220, totalLabel = "Total", centerValue }: { data: { name: string; value: number; color: string }[]; height?: number; totalLabel?: string; centerValue?: string }) {
  const animate = useChartMotion();
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="donut" style={{ height }}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="92%" paddingAngle={2}
            cornerRadius={6} stroke="none" isAnimationActive={animate} {...chartMotion}>
            {data.map((d) => <Cell key={d.name} fill={d.color} />)}
          </Pie>
          <Tooltip content={<ChartTooltip />} isAnimationActive={animate} animationDuration={700} animationEasing="ease-out" />
        </PieChart>
      </ResponsiveContainer>
      <div className="donut-total"><span>{totalLabel}</span><strong aria-label={centerValue ?? formatINR(total)}>{centerValue ?? formatINRCompact(total)}</strong></div>
    </div>
  );
}

export function CashflowBars({ data }: { data: { label: string; income: number; spend: number; invested: number }[] }) {
  const animate = useChartMotion();
  const id = useId().replace(/:/g, "");
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} barGap={4}>
        <defs>
          {(["income", "spend", "invest"] as const).map((series) => (
            <linearGradient key={series} id={`${id}-${series}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={`var(--lk-${series})`} stopOpacity={.95} />
              <stop offset="100%" stopColor={`var(--lk-${series})`} stopOpacity={.6} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} stroke="var(--lk-grid)" />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} tickFormatter={(v) => formatINRCompact(v)} width={56} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--lk-grid)" }} isAnimationActive={animate} animationDuration={700} animationEasing="ease-out" />
        <Bar dataKey="income" name="Income" fill={`url(#${id}-income)`} radius={[7, 7, 3, 3]} maxBarSize={24} isAnimationActive={animate} {...chartMotion} />
        <Bar dataKey="spend" name="Spend" fill={`url(#${id}-spend)`} radius={[7, 7, 3, 3]} maxBarSize={24} isAnimationActive={animate} {...chartMotion} />
        <Bar dataKey="invested" name="Invested" fill={`url(#${id}-invest)`} radius={[7, 7, 3, 3]} maxBarSize={24} isAnimationActive={animate} {...chartMotion} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AreaTrend({ data, x, y, name, height = 220, color = "var(--lk-gold-text)" }: {
  data: object[]; x: string; y: string; name: string; height?: number; color?: string;
}) {
  const id = useId().replace(/:/g, "");
  const animate = useChartMotion();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.24} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--lk-grid)" />
        <XAxis dataKey={x} {...axis} minTickGap={24} />
        <YAxis {...axis} tickFormatter={(v) => formatINRCompact(v)} width={56} />
        <Tooltip content={<ChartTooltip />} isAnimationActive={animate} animationDuration={700} animationEasing="ease-out" />
        <Area type="monotone" dataKey={y} name={name} stroke={color} strokeWidth={3} fill={`url(#${id})`} isAnimationActive={animate} {...chartMotion} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MultiLine({ data, x, lines, height = 240 }: {
  data: object[]; x: string; lines: { key: string; name: string; color: string; dashed?: boolean }[]; height?: number;
}) {
  const animate = useChartMotion();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <CartesianGrid vertical={false} stroke="var(--lk-grid)" />
        <XAxis dataKey={x} {...axis} minTickGap={20} />
        <YAxis {...axis} tickFormatter={(v) => formatINRCompact(v)} width={60} />
        <Tooltip content={<ChartTooltip />} isAnimationActive={animate} animationDuration={700} animationEasing="ease-out" />
        {lines.map((l) => (
          <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color} strokeWidth={3}
            dot={false} strokeDasharray={l.dashed ? "6 6" : undefined} isAnimationActive={animate} {...chartMotion} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
