"use client";
import { AreaTrend, Donut } from "@/components/charts";
import { useTier } from "@/components/useTier";
import { Glass, PageHeader, PremiumBadge, Stat } from "@/components/ui";
import { DataGate, useData } from "@/components/DataState";
import { formatDate, formatINR, formatMonth, formatPct } from "@/lib/format";
import { moneyMasked } from "@/lib/privacy";
import { assetAllocation, balanceHistory, monthlyCashflow, netWorthHistory } from "@/lib/selectors";

const TYPE_LABEL: Record<string, string> = {
  savings: "Savings", current: "Current account", mutual_fund: "Mutual funds", fixed_deposit: "Fixed deposits", stocks: "Stocks",
};
const TYPE_COLOR = ["var(--lk-income)", "var(--lk-invest)", "var(--lk-gold-text)", "var(--lk-blue)", "var(--lk-lotus)", "var(--lk-indigo)"];

function HistoryView() {
  const { accounts, transactions } = useData();
  const { limit } = useTier();
  const months = limit("history.full");
  const savings = accounts.find((a) => a.type === "savings") ?? accounts.find((a) => a.type === "current")!;
  const hist = balanceHistory(savings, transactions).map((p) => ({ ...p, label: formatDate(p.date).replace(/ \d{4}$/, "") }));
  const flow = monthlyCashflow(transactions);
  const cumSaved = flow.reduce((s, f) => s + f.saved, 0);
  const worth = (months === null ? netWorthHistory(accounts, transactions) : netWorthHistory(accounts, transactions).slice(-months))
    .map((p) => ({ ...p, label: formatMonth(p.month) }));
  const allocation = assetAllocation(accounts).map((slice, i) => ({ ...slice, name: TYPE_LABEL[slice.type] ?? slice.type, color: TYPE_COLOR[i % TYPE_COLOR.length] }));
  const hidden = moneyMasked();

  return (
    <>
      <PageHeader title="History" subtitle={months !== null ? `Free keeps ${months} months of history` : "Unlimited history"}>
        {months !== null ? <span className="badge">{months} months</span> : <PremiumBadge />}
      </PageHeader>
      <div className="grid g3">
        <Glass className="card"><Stat label="Months tracked" value={String(flow.length)} /></Glass>
        <Glass className="card"><Stat label="Total saved" value={formatINR(cumSaved)} tone={cumSaved >= 0 ? "up" : "down"} /></Glass>
        <Glass className="card"><Stat label={`${savings.name} today`} value={formatINR(savings.balance)} /></Glass>
      </div>
      <Glass className="card">
        <div className="card-head"><h2>Net worth</h2><span className="muted tiny">Month-end, from these accounts</span></div>
        <AreaTrend data={worth} x="label" y="net" name="Net worth" height={280} color="var(--lk-gold-text)" />
      </Glass>
      <Glass className="card">
        <div className="card-head"><h2>Where it sits</h2><span className="muted tiny">{hidden ? "Shares only" : "Today, loans and cards left out"}</span></div>
        <div className="grid g2">
          <Donut data={allocation.map((s) => ({ name: s.name, value: s.amount, color: s.color }))} totalLabel="Owned" height={220} centerValue={hidden ? "100%" : undefined} />
          <table className="allocation-table">
            <caption className="sr-only">Share of what you own</caption>
            <thead><tr><th scope="col">Account</th><th scope="col">Share</th>{hidden ? null : <th scope="col">Amount</th>}</tr></thead>
            <tbody>
              {allocation.map((s) => (
                <tr key={s.type}><td>{s.name}</td><td>{formatPct(s.pct, 0)}</td>{hidden ? null : <td>{formatINR(s.amount)}</td>}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </Glass>
      <Glass className="card">
        <div className="card-head"><h2>{savings.name} balance</h2><span className="muted tiny">Reconstructed from transactions</span></div>
        <AreaTrend data={hist} x="label" y="balance" name="Balance" height={300} color="var(--c-income)" />
      </Glass>
    </>
  );
}

export default function HistoryPage() {
  return <DataGate title="History" need={["savings", "transactions"]}><HistoryView /></DataGate>;
}
