"use client";
import { useState } from "react";
import { MultiLine } from "@/components/charts";
import { Glass, PageHeader, PremiumBadge, Progress, Stat } from "@/components/ui";
import { PremiumGate } from "@/components/ui";
import { DataGate, useData } from "@/components/DataState";
import { formatINR, formatPct, titleCase } from "@/lib/format";
import { amortise } from "@/lib/selectors";

function DebtView() {
  const { debts } = useData();
  const [extra, setExtra] = useState(200000); // ₹2,000/month prepayment, in paise
  const d = debts[0];
  if (!d) return <PageHeader title="Debt" subtitle="No debts. Wonderful! 🎉" />;
  const base = amortise(d);
  const fast = amortise(d, extra);
  const merged = base.points.map((p, i) => ({ month: `M${p.month}`, current: p.balance, prepay: fast.points[i]?.balance ?? 0 }));
  const paidPct = ((d.principal - d.outstanding) / d.principal) * 100;

  return (
    <>
      <PageHeader title="Debt" subtitle="Payoff planner: see how small prepayments save real money"><PremiumBadge /></PageHeader>
      <PremiumGate feature="Debt planner" id="debt.planner">
        <div className="grid g4">
          <Glass className="card"><Stat label="Outstanding" value={formatINR(d.outstanding)} hint={`${formatPct(paidPct, 0)} repaid`} /></Glass>
          <Glass className="card"><Stat label="EMI" value={formatINR(d.emi)} hint={`${d.annualRatePct}% p.a.`} /></Glass>
          <Glass className="card"><Stat label="Debt-free in" value={`${base.months} mo`} hint={`${formatINR(base.interest)} interest left`} /></Glass>
          <Glass className="card"><Stat label="With prepayment" value={`${fast.months} mo`} tone="up"
            hint={`Save ${formatINR(base.interest - fast.interest)} · ${base.months - fast.months} months sooner`} /></Glass>
        </div>
        <div className="grid g3" style={{ marginTop: 20 }}>
          <Glass className="card span2">
            <div className="card-head"><h2>Balance over time</h2><span className="muted tiny">Current plan vs prepayment</span></div>
            <MultiLine data={merged} x="month" lines={[
              { key: "current", name: "Current plan", color: "var(--muted)", dashed: true },
              { key: "prepay", name: "With prepayment", color: "var(--accent)" },
            ]} />
          </Glass>
          <Glass className="card">
            <h2>{d.name}</h2>
            <p className="muted">{d.lender} · {titleCase(d.kind)}</p>
            <Progress pct={paidPct} />
            <label className="field">
              Extra prepayment per month: {formatINR(extra)}
              <input type="range" min={0} max={1000000} step={50000} value={extra} aria-valuetext={formatINR(extra).includes("•") ? "Amount hidden" : formatINR(extra)} onChange={(e) => setExtra(Number(e.target.value))} />
            </label>
            <p className="muted tiny">Avalanche tip: put extra money on the highest-rate debt first. Illustrative maths; check your lender&apos;s prepayment terms.</p>
          </Glass>
        </div>
      </PremiumGate>
    </>
  );
}

export default function DebtPage() {
  return <DataGate title="Debt" need={["debts"]}><DebtView /></DataGate>;
}
