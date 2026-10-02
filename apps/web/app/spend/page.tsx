"use client";
import { useState } from "react";
import { AreaTrend, Donut } from "@/components/charts";
import { MonthPicker } from "@/components/MonthPicker";
import { Glass, PageHeader, Stat } from "@/components/ui";
import { transactions } from "@/lib/data";
import { formatDate, formatINR, formatMonth, titleCase } from "@/lib/format";
import { CATEGORY_COLORS, dailySpend, defaultMonth, months, spendByCategory, topMerchants } from "@/lib/selectors";

export default function SpendPage() {
  const all = months(transactions).filter((m) => m <= defaultMonth(transactions));
  const [month, setMonth] = useState(all[all.length - 1]);
  const [q, setQ] = useState("");
  const cats = spendByCategory(transactions, month);
  const total = cats.reduce((s, c) => s + c.amount, 0);
  const daily = dailySpend(transactions, month);
  const merchants = topMerchants(transactions, month);
  const list = transactions
    .filter((t) => t.date.startsWith(month))
    .filter((t) => !q || `${t.merchant} ${t.description} ${t.category}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <PageHeader title="Spend" subtitle={`${formatMonth(month)} · ${formatINR(total)} across ${cats.length} categories`}>
        <MonthPicker months={all} value={month} onChange={setMonth} />
      </PageHeader>

      <div className="grid g3">
        <Glass className="card">
          <div className="card-head"><h2>By category</h2></div>
          <Donut data={cats.map((c) => ({ name: titleCase(c.category), value: c.amount, color: CATEGORY_COLORS[c.category] ?? "#999" }))} />
          <div className="legend">
            {cats.map((c) => (
              <div key={c.category}><span className="dot" style={{ background: CATEGORY_COLORS[c.category] }} />{titleCase(c.category)}<b>{formatINR(c.amount)}</b></div>
            ))}
          </div>
        </Glass>
        <Glass className="card span2">
          <div className="card-head"><h2>Running total</h2><Stat label="" value={formatINR(total)} /></div>
          <AreaTrend data={daily} x="day" y="cumulative" name="Spent so far" height={260} />
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

      <Glass className="card">
        <div className="card-head"><h2>Transactions</h2><span className="muted tiny">{list.length} shown</span></div>
        <input type="search" placeholder="Search merchant, category…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search transactions" />
        <div className="list">
          {list.map((t) => (
            <div className="row" key={t.id}>
              <div className="avatar" style={{ background: CATEGORY_COLORS[t.category] ?? "#64748b" }}>{(t.merchant ?? t.description)[0]}</div>
              <div className="grow">
                <div className="title">{t.merchant ?? t.description}</div>
                <div className="sub">{formatDate(t.date)} · {titleCase(t.category)} · {t.method?.toUpperCase()}{t.recurring ? " · recurring" : ""}</div>
              </div>
              <div className={`amt ${t.amount > 0 ? "up" : ""}`}>{formatINR(t.amount, { signed: true })}</div>
            </div>
          ))}
          {!list.length && <p className="empty muted">No matching transactions.</p>}
        </div>
      </Glass>
    </>
  );
}
