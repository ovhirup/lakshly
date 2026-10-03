"use client";
import { Glass, PageHeader, PremiumBadge, PremiumGate, Stat } from "@/components/ui";
import { DataGate, useData } from "@/components/DataState";
import { formatCount, formatDate, formatINR, titleCase } from "@/lib/format";

function RewardsView() {
  const { rewards } = useData();
  const total = rewards.reduce((s, r) => s + r.balance * (r.valuePerUnitPaise ?? 0), 0);
  return (
    <>
      <PageHeader title="Rewards" subtitle="Points, cashback and expiries, all in rupees"><PremiumBadge /></PageHeader>
      <PremiumGate feature="Rewards tracking" id="rewards.tracking">
        <div className="grid g3">
          <Glass className="card"><Stat label="Total value" value={formatINR(total)} hint="Estimated redemption value" tone="up" /></Glass>
          {rewards.map((r) => (
            <Glass className="card span2" key={r.id}>
              <div className="card-head"><h2>{r.program}</h2><span className="badge">{titleCase(r.kind)}</span></div>
              <div className="grid g3">
                <Stat label="Balance" value={formatCount(r.balance)} />
                <Stat label="Worth" value={formatINR(r.balance * (r.valuePerUnitPaise ?? 0))} hint={`${formatINR(r.valuePerUnitPaise ?? 0, { decimals: true })} per point`} />
                <Stat label="Expires" value={r.expiresOn ? formatDate(r.expiresOn) : "No expiry"} />
              </div>
              <p className="muted tiny">🔔 We&apos;ll nudge you 30 days before points expire.</p>
            </Glass>
          ))}
        </div>
      </PremiumGate>
    </>
  );
}

export default function RewardsPage() {
  return <DataGate title="Rewards" need={["rewards"]}><RewardsView /></DataGate>;
}
