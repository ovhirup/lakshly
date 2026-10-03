"use client";
import { useState } from "react";
import { AreaTrend, Donut } from "@/components/charts";
import { MonthPicker } from "@/components/MonthPicker";
import { ReviewChip } from "@/components/ReviewParts";
import { NudgeCard } from "@/components/Game";
import { Glass, PageHeader, Stat } from "@/components/ui";
import { DataGate, useData } from "@/components/DataState";
import { formatDate, formatINR, formatMonth, titleCase } from "@/lib/format";
import { CATEGORY_COLORS, dailySpend, defaultMonth, months, spendByCategory, topMerchants } from "@/lib/selectors";

function SpendView() {
  const { transactions } = useData();
  const all = months(transactions).filter((m) => m <= defaultMonth(transactions));
  const [month, setMonth] = useState(all[all.length - 1]);
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);
  const cats = spendByCategory(transactions, month);
  const total = cats.reduce((s, c) => s + c.amount, 0);
  const daily = dailySpend(transactions, month);
  const merchants = topMerchants(transactions, month);
  const list = transactions
    .filter((t) => t.date.startsWith(month))
    .filter((t) => !q || `${t.merchant} ${t.description} ${t.category}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date));
  const visible = showAll ? list : list.slice(0, 20);
  const days = [...new Set(visible.map((t) => t.date))].map((date) => ({
    date,
    rows: visible.filter((t) => t.date === date),
    net: list.filter((t) => t.date === date).reduce((sum, t) => sum + t.amount, 0),
  }));

  return (
    <>
      <PageHeader title="Spend" subtitle={`${formatMonth(month)} · ${formatINR(total)} across ${cats.length} categories`}>
        <div className="spend-head-actions">
          <ReviewChip />
          <MonthPicker months={all} value={month} onChange={(value) => { setMonth(value); setShowAll(false); }} />
        </div>
      </PageHeader>
      <NudgeCard screen="spend" />

      <div className="grid g3">
        <Glass className="card">
          <div className="card-head"><h2>By category</h2></div>
          <Donut data={cats.map((c) => ({ name: titleCase(c.category), value: c.amount, color: CATEGORY_COLORS[c.category] ?? "var(--lk-text-muted)" }))} />
          <div className="legend">
            {cats.map((c) => (
              <div key={c.category}><span className="dot" style={{ background: CATEGORY_COLORS[c.category] }} />{titleCase(c.category)}<b>{formatINR(c.amount)}</b></div>
            ))}
          </div>
        </Glass>
        <Glass className="card span2">
          <div className="card-head"><h2>Running total</h2><Stat label="" value={formatINR(total)} /></div>
          <AreaTrend data={daily} x="day" y="cumulative" name="Spent so far" height={260} color="var(--lk-spend)" />
          <h2>Top merchants</h2>
          <div className="list">
            {merchants.map((m) => (
              <div className="row" key={m.merchant}>
                <span className="dot" style={{ background: CATEGORY_COLORS[m.category] }} />
                <div className="grow"><div className="title">{m.merchant}</div><div className="sub">{m.count} payments · {titleCase(m.category)}</div></div>
                <div className="amt">{formatINR(m.amount)}</div>
              </div>
            ))}
          </div>
        </Glass>
      </div>

      <Glass className="card transactions-card">
        <div className="card-head"><h2>Transactions</h2><span className="muted tiny" aria-live="polite">{visible.length} of {list.length} shown</span></div>
        <input type="search" placeholder="Search merchant, category…" value={q} onChange={(e) => { setQ(e.target.value); setShowAll(false); }} aria-label="Search transactions" />
        <div className="transaction-days" id="transaction-list">
          {days.map(({ date, rows, net }) => (
            <section className="transaction-day" key={date} aria-label={formatDate(date)}>
              <header className="day-header">
                <h3>{formatDate(date)}</h3>
                <span>{q ? "Matching net" : "Day net"} · <span className={net > 0 ? "money-income" : undefined}>{formatINR(net, { signed: true })}</span></span>
              </header>
              <div className="list">
                {rows.map((t) => (
                  <div className="row transaction-row" key={t.id}>
                    <div className="avatar">{(t.merchant ?? t.description)[0]}</div>
                    <div className="grow">
                      <div className="title">{t.merchant ?? t.description}</div>
                      <div className="sub">{titleCase(t.category)}{t.method ? ` · ${t.method.toUpperCase()}` : ""}{t.recurring ? " · recurring" : ""}</div>
                    </div>
                    <div className={`amt ${t.amount > 0 ? "money-income" : t.category === "transfers" ? "muted" : "money-spend"}`}>{formatINR(t.amount, { signed: true })}</div>
                  </div>
                ))}
              </div>
            </section>
          ))}
          {!list.length && <p className="empty muted">No matching transactions.</p>}
        </div>
        {list.length > 20 && <button className="btn ghost transactions-toggle" aria-controls="transaction-list" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show fewer transactions" : `Show all ${list.length} transactions`}
        </button>}
      </Glass>
    </>
  );
}

export default function SpendPage() {
  return <DataGate title="Spend" need={["transactions"]}><SpendView /></DataGate>;
}
