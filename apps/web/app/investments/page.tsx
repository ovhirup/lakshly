"use client";
import { useState } from "react";
import { MultiLine } from "@/components/charts";
import { Glass, PageHeader, PremiumBadge, PremiumGate, Stat } from "@/components/ui";
import { accounts, sips } from "@/lib/data";
import { formatINR, formatPct, titleCase } from "@/lib/format";
import { sipProjection } from "@/lib/selectors";

export default function InvestmentsPage() {
  const [ret, setRet] = useState(11);
  const holdings = accounts.filter((a) => ["mutual_fund", "fixed_deposit", "stocks", "epf", "ppf", "nps"].includes(a.type));
  const value = holdings.reduce((s, a) => s + a.balance, 0);
  const monthlySip = sips.filter((s) => s.status === "active").reduce((s, x) => s + x.amount, 0);
  const proj = sips.map((s) => sipProjection(s, 10, ret));
  const series = Array.from({ length: 10 }, (_, i) => ({
    year: `Y${i + 1}`,
    invested: proj.reduce((s, p) => s + p[i].invested, 0),
    value: proj.reduce((s, p) => s + p[i].value, 0),
  }));
  const last = series[series.length - 1];

  return (
    <>
      <PageHeader title="Investments & SIPs" subtitle="Holdings, active SIPs and an illustrative projection"><PremiumBadge /></PageHeader>
      <PremiumGate feature="Investments & SIPs">
        <div className="grid g4">
          <Glass className="card"><Stat label="Holdings value" value={formatINR(value)} /></Glass>
          <Glass className="card"><Stat label="Monthly SIPs" value={formatINR(monthlySip)} hint={`${sips.length} active`} /></Glass>
          <Glass className="card"><Stat label="10-yr invested" value={formatINR(last.invested)} /></Glass>
          <Glass className="card"><Stat label={`10-yr value @ ${ret}%`} value={formatINR(last.value)} tone="up" hint="Illustrative, not a promise" /></Glass>
        </div>
        <div className="grid g3" style={{ marginTop: 20 }}>
          <Glass className="card span2">
            <div className="card-head"><h2>SIP projection</h2><span className="muted tiny">Includes yearly step-ups</span></div>
            <MultiLine data={series} x="year" lines={[
              { key: "invested", name: "Invested", color: "var(--muted)", dashed: true },
              { key: "value", name: "Projected value", color: "var(--c-invest)" },
            ]} />
            <label className="field">Assumed annual return: {ret}%
              <input type="range" min={4} max={15} step={0.5} value={ret} onChange={(e) => setRet(Number(e.target.value))} />
            </label>
          </Glass>
          <Glass className="card">
            <h2>Holdings</h2>
            <div className="list">
              {holdings.map((h) => {
                const gain = h.invested ? h.balance - h.invested : null;
                return (
                  <div className="row" key={h.id}>
                    <div className="grow"><div className="title">{h.name}</div><div className="sub">{h.institution} · {titleCase(h.type)}</div></div>
                    <div style={{ textAlign: "right" }}>
                      <div className="amt">{formatINR(h.balance)}</div>
                      {gain !== null && h.invested ? <div className="tiny up">{formatINR(gain, { signed: true })} · {formatPct((gain / h.invested) * 100)}</div> : null}
                    </div>
                  </div>
                );
              })}
            </div>
            <h2>SIPs</h2>
            <div className="list">
              {sips.map((s) => (
                <div className="row" key={s.id}>
                  <div className="grow"><div className="title">{s.scheme}</div><div className="sub">{s.platform} · day {s.dayOfMonth}{s.stepUpPctYearly ? ` · +${s.stepUpPctYearly}%/yr` : ""}</div></div>
                  <div className="amt">{formatINR(s.amount)}</div>
                </div>
              ))}
            </div>
          </Glass>
        </div>
        <p className="note">Projections are illustrative maths only and not investment advice.</p>
      </PremiumGate>
    </>
  );
}
