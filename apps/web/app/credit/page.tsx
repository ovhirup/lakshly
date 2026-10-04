"use client";
import { useSyncExternalStore } from "react";
import { Donut } from "@/components/charts";
import { Glass, PageHeader, PremiumBadge, PremiumGate, Progress, Stat } from "@/components/ui";
import { DataGate, useData } from "@/components/DataState";
import { formatDate, formatINR, formatPct } from "@/lib/format";
import { cardDueWhen, daysUntil, nextDueDate } from "@/lib/card-due";
import { creditCards } from "@/lib/selectors";

let dayCache = "1970-01-01";
function readDay() {
  const n = new Date();
  const today = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  if (dayCache === today) return dayCache;
  dayCache = today;
  return dayCache;
}

function cycleLabel(day: number | undefined, today: string) {
  if (typeof day !== "number") return "—";
  const date = nextDueDate(day, today);
  return `${formatDate(date)} · ${cardDueWhen(daysUntil(today, date))}`;
}

function CreditView() {
  const { accounts } = useData();
  const today = useSyncExternalStore(() => () => {}, readDay, () => dayCache);
  const cards = creditCards(accounts);
  return (
    <>
      <PageHeader title="Credit" subtitle="Utilisation, due dates and statement cycles"><PremiumBadge /></PageHeader>
      <PremiumGate feature="Credit insights" id="credit.insights">
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
                  <div className="row"><div className="grow"><div className="title">Next statement</div><div className="sub">Day {c.statementDay} of each month</div></div><div className="amt">{cycleLabel(c.statementDay, today)}</div></div>
                  <div className="row"><div className="grow"><div className="title">Payment due</div><div className="sub">Pay in full to avoid interest</div></div><div className="amt">{cycleLabel(c.dueDay, today)}</div></div>
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

export default function CreditPage() {
  return <DataGate title="Credit" need={["cards"]}><CreditView /></DataGate>;
}
