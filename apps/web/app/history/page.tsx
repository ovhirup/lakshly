"use client";
import { AreaTrend } from "@/components/charts";
import { useTier } from "@/components/useTier";
import { Glass, PageHeader, PremiumBadge, Stat } from "@/components/ui";
import { DataGate, useData } from "@/components/DataState";
import { formatDate, formatINR } from "@/lib/format";
import { balanceHistory, monthlyCashflow } from "@/lib/selectors";

function HistoryView() {
  const { accounts, transactions } = useData();
  const { limit } = useTier();
  const months = limit("history.full");
  const savings = accounts.find((a) => a.type === "savings") ?? accounts.find((a) => a.type === "current")!;
  const hist = balanceHistory(savings, transactions).map((p) => ({ ...p, label: formatDate(p.date).replace(/ \d{4}$/, "") }));
  const flow = monthlyCashflow(transactions);
  const cumSaved = flow.reduce((s, f) => s + f.saved, 0);

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
        <div className="card-head"><h2>{savings.name} balance</h2><span className="muted tiny">Reconstructed from transactions</span></div>
        <AreaTrend data={hist} x="label" y="balance" name="Balance" height={300} color="var(--c-income)" />
      </Glass>
    </>
  );
}

export default function HistoryPage() {
  return <DataGate title="History" need={["savings", "transactions"]}><HistoryView /></DataGate>;
}
