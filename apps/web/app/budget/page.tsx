"use client";
import { useState } from "react";
import { MonthPicker } from "@/components/MonthPicker";
import { useAppState } from "@/components/AppState";
import { Glass, PageHeader, PremiumBadge, Progress, Stat } from "@/components/ui";
import { budgets, transactions } from "@/lib/data";
import { formatINR, formatMonth, formatPct, titleCase } from "@/lib/format";
import { budgetProgress, CATEGORY_COLORS, defaultMonth, months } from "@/lib/selectors";

export default function BudgetPage() {
  const { plan, setPlan } = useAppState();
  const all = months(transactions).filter((m) => m <= defaultMonth(transactions));
  const [month, setMonth] = useState(all[all.length - 1]);
  const rows = budgetProgress(budgets, transactions, month);
  const totalLimit = rows.reduce((s, r) => s + r.limit, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);
  const onTrack = rows.filter((r) => r.pct <= 100).length;

  return (
    <>
      <PageHeader title="Budget" subtitle={`${formatMonth(month)} · ${onTrack} of ${rows.length} budgets on target`}>
        <MonthPicker months={all} value={month} onChange={setMonth} />
      </PageHeader>

      <div className="grid g3">
        <Glass className="card"><Stat label="Budgeted" value={formatINR(totalLimit)} /></Glass>
        <Glass className="card"><Stat label="Spent" value={formatINR(totalSpent)} hint={formatPct((totalSpent / totalLimit) * 100, 0) + " used"} /></Glass>
        <Glass className="card"><Stat label={totalLimit - totalSpent >= 0 ? "Left to spend" : "Over by"} value={formatINR(Math.abs(totalLimit - totalSpent))}
          tone={totalLimit - totalSpent >= 0 ? "up" : "down"} hint={totalLimit - totalSpent >= 0 ? "Nicely on target 🎯" : "Let's rebalance next month"} /></Glass>
      </div>

      <div className="grid g2">
        {rows.map((r, i) => {
          const locked = plan === "free" && i > 0;
          return (
            <Glass key={r.id} className="card" style={locked ? { opacity: 0.7 } : undefined}>
              <div className="card-head">
                <h2><span className="dot" style={{ background: CATEGORY_COLORS[r.category], display: "inline-block", marginRight: 8 }} />{titleCase(r.category)}</h2>
                {locked ? <PremiumBadge small /> : <span className={`tiny ${r.pct > 100 ? "down" : "muted"}`}>{formatPct(r.pct, 0)}</span>}
              </div>
              {locked ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <p className="muted">Free includes 1 budget. Premium unlocks unlimited budgets, rollovers and smart nudges.</p>
                  <button className="btn ghost" onClick={() => setPlan("premium")}>Preview Premium (demo)</button>
                </div>
              ) : (
                <>
                  <Progress pct={r.pct} color={CATEGORY_COLORS[r.category]} />
                  <div className="card-head">
                    <span className="muted">{formatINR(r.spent)} of {formatINR(r.limit)}</span>
                    <strong className={r.left < 0 ? "down" : "up"}>{r.left < 0 ? `${formatINR(-r.left)} over` : `${formatINR(r.left)} left`}</strong>
                  </div>
                  {r.rollover && <span className="tiny muted">↻ Rollover on</span>}
                </>
              )}
            </Glass>
          );
        })}
      </div>
    </>
  );
}
