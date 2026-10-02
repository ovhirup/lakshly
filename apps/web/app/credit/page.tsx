"use client";
import { Donut } from "@/components/charts";
import { Glass, PageHeader, PremiumBadge, PremiumGate, Progress, Stat } from "@/components/ui";
import { accounts } from "@/lib/data";
import { formatINR, formatPct } from "@/lib/format";
import { creditCards } from "@/lib/selectors";

function nextDate(day: number, from: string) {
  const [y, m, d] = from.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + (d > day ? 1 : 0), day));
  return dt.toISOString().slice(0, 10);
}

export default function CreditPage() {
  const cards = creditCards(accounts);
  return (
    <>
      <PageHeader title="Credit" subtitle="Utilisation, due dates and statement cycles"><PremiumBadge /></PageHeader>
      <PremiumGate feature="Credit insights">
        {cards.map((c) => {
          const tone = c.utilisation < 30 ? "up" : "down";
          return (
            <div className="grid g3" key={c.id}>
              <Glass className="card">
                <h2>{c.name}</h2>
                <p className="muted">{c.institution} ·••{c.mask}</p>
                <Donut height={190} data={[
                  { name: "Used", value: c.owed, color: c.utilisation < 30 ? "var(--lk-income)" : "var(--lk-spend)" },
                  { name: "Available", value: c.available, color: "var(--grid)" },
                ]} />
                <p style={{ textAlign: "center" }}><strong className={tone} style={{ fontSize: "1.6rem" }}>{formatPct(c.utilisation, 0)}</strong> <span className="muted">utilised</span></p>
              </Glass>
              <Glass className="card span2">
                <div className="grid g3">
                  <Stat label="Outstanding" value={formatINR(c.owed)} />
                  <Stat label="Available" value={formatINR(c.available)} />
                  <Stat label="Limit" value={formatINR(c.limit)} />
                </div>
                <Progress pct={c.utilisation} color={c.utilisation < 30 ? "var(--lk-income)" : undefined} />
                <div className="list">
                  <div className="row"><div className="grow"><div className="title">Next statement</div><div className="sub">Day {c.statementDay} of each month</div></div><div className="amt">{nextDate(c.statementDay ?? 1, c.asOf)}</div></div>
                  <div className="row"><div className="grow"><div className="title">Payment due</div><div className="sub">Pay in full to avoid interest</div></div><div className="amt">{nextDate(c.dueDay ?? 1, c.asOf)}</div></div>
                </div>
                <p className="muted tiny">💡 Keeping utilisation under 30% is generally kinder to your credit score.</p>
              </Glass>
            </div>
          );
        })}
      </PremiumGate>
    </>
  );
}
