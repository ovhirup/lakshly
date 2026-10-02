"use client";
import Link from "next/link";
import { CashflowBars, Donut } from "@/components/charts";
import { Glass, PageHeader, Progress, Stat } from "@/components/ui";
import { accounts, transactions, dataset } from "@/lib/data";
import { formatDate, formatINR, formatMonth, formatPct, titleCase } from "@/lib/format";
import { CATEGORY_COLORS, defaultMonth, monthlyCashflow, netWorth, spendByCategory } from "@/lib/selectors";

const TYPE_COLOR: Record<string, string> = {
  savings: "#10b981", credit_card: "#ec4899", mutual_fund: "#8b5cf6", fixed_deposit: "#f59e0b", loan: "#f43f5e",
};

export default function OverviewPage() {
  const nw = netWorth(accounts);
  const month = defaultMonth(transactions);
  const flow = monthlyCashflow(transactions).filter((m) => m.month <= month);
  const cur = flow[flow.length - 1];
  const mf = accounts.find((a) => a.type === "mutual_fund");
  const mfGain = mf && mf.invested ? mf.balance - mf.invested : 0;
  const cats = spendByCategory(transactions, month).slice(0, 6);
  const maxAsset = Math.max(...accounts.map((a) => Math.abs(a.balance)));

  return (
    <>
      <PageHeader title="Overview" subtitle={`Synthetic demo data · as of ${formatDate(accounts[0].asOf)}`} />

      <Glass className="hero">
        <p className="eyebrow">Net worth</p>
        <p className="big">{formatINR(nw.net)}</p>
        <div className="pills">
          <span className="pill">{formatINR(nw.assets)} assets</span>
          <span className="pill">{formatINR(-nw.liabilities)} owed</span>
          {mf?.invested ? <span className="pill">{formatINR(mfGain, { signed: true })} fund gains · {formatPct((mfGain / mf.invested) * 100)}</span> : null}
        </div>
        <p className="tagline">Every rupee on target. 🎯</p>
      </Glass>

      <div className="grid g4">
        <Glass className="card"><Stat label={`Income · ${formatMonth(month, true)}`} value={formatINR(cur.income)} /></Glass>
        <Glass className="card"><Stat label="Spent" value={formatINR(cur.spend)} hint={`${formatPct((cur.spend / cur.income) * 100, 0)} of income`} /></Glass>
        <Glass className="card"><Stat label="Invested" value={formatINR(cur.invested)} hint="SIPs this month" /></Glass>
        <Glass className="card"><Stat label="Saved" value={formatINR(cur.saved)} tone={cur.saved >= 0 ? "up" : "down"}
          hint={`${formatPct((cur.saved / cur.income) * 100, 0)} savings rate`} /></Glass>
      </div>

      <div className="grid g3">
        <Glass className="card span2">
          <div className="card-head"><h2>Cash flow</h2><span className="muted tiny">Income · Spend · Invested</span></div>
          <CashflowBars data={flow.map((f) => ({ ...f, label: formatMonth(f.month, true) }))} />
        </Glass>
        <Glass className="card">
          <div className="card-head"><h2>Where it went</h2><Link href="/spend/" className="muted tiny">See all →</Link></div>
          <Donut height={180} data={cats.map((c) => ({ name: titleCase(c.category), value: c.amount, color: CATEGORY_COLORS[c.category] ?? "#999" }))} />
          <div className="legend">
            {cats.slice(0, 4).map((c) => (
              <div key={c.category}><span className="dot" style={{ background: CATEGORY_COLORS[c.category] }} />{titleCase(c.category)}<b>{formatINR(c.amount)}</b></div>
            ))}
          </div>
        </Glass>
      </div>

      <Glass className="card">
        <div className="card-head"><h2>Accounts</h2><span className="muted tiny">{dataset.notice}</span></div>
        <div className="list">
          {accounts.map((a) => (
            <div className="row" key={a.id}>
              <div className="avatar" style={{ background: TYPE_COLOR[a.type] ?? "#64748b" }}>{a.name[0]}</div>
              <div className="grow">
                <div className="title">{a.name}</div>
                <div className="sub">{a.institution}{a.mask ? ` ·••${a.mask}` : ""} · {titleCase(a.type)}</div>
                <div style={{ marginTop: 8, maxWidth: 360 }}><Progress pct={(Math.abs(a.balance) / maxAsset) * 100} color={TYPE_COLOR[a.type]} /></div>
              </div>
              <div className={`amt ${a.balance < 0 ? "down" : ""}`}>{formatINR(a.balance)}</div>
            </div>
          ))}
        </div>
      </Glass>
    </>
  );
}
