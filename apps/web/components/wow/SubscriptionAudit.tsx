"use client";
import { useData } from "@/components/DataState";
import { Amount } from "@/components/Privacy";
import { useTier } from "@/components/useTier";
import { Glass } from "@/components/ui";
import { formatINR, formatPct } from "@/lib/format";
import {
  buildAudit, flagText, kindTitle, scheduleLine, togglePlanned,
  type SubscriptionFlag,
} from "@/lib/wow/subscription-audit";
import "../wow.css";

function flagLabel(flag: SubscriptionFlag): string {
  if (flag.type === "priceUp") return `Price up ${formatPct(flag.pct, 0)}`;
  return flagText(flag);
}

/** Subscription audit on Spend. Free (`wow.subscriptionAudit`). Lakshly never cancels a charge. */
export function SubscriptionAuditCard() {
  const { can } = useTier();
  const { transactions, review, wow } = useData();
  if (!can("wow.subscriptionAudit")) return null;

  const planned = new Set(wow.state.plannedCancels);
  const audit = buildAudit(transactions, review.now, planned);
  const activeCount = audit.items.filter((item) => !item.lapsed).length;
  const noun = activeCount === 1 ? "subscription" : "subscriptions";

  return (
    <Glass className="card wow-audit" data-testid="wow-subscription-audit-card">
      <h2>Subscription audit</h2>
      {audit.items.length === 0 ? (
        <p className="muted">No subscriptions spotted yet. Import a few months of statements.</p>
      ) : (
        <>
          <p className="wow-audit-headline" data-testid="wow-subscription-audit-headline">
            <Amount>{formatINR(audit.monthlyTotalPaise)}</Amount>
            {" a month · "}
            <Amount>{formatINR(audit.yearlyTotalPaise)}</Amount>
            {` a year on ${activeCount} ${noun}`}
          </p>
          <ul className="wow-audit-list">
            {audit.items.map((item) => {
              const marked = planned.has(item.id);
              const look = item.verdict === "Worth a look";
              return (
                <li className="wow-audit-row" key={item.id}>
                  <div className="wow-audit-top">
                    <span className="wow-audit-name">{item.name}</span>
                    <span className="wow-audit-amt"><Amount>{formatINR(item.monthlyPaise)}</Amount></span>
                  </div>
                  <div className="wow-audit-meta">
                    <span className="wow-pill">{kindTitle(item.kind)}</span>
                    <span className="wow-audit-when">{scheduleLine(item)}</span>
                  </div>
                  {item.flags.length > 0 && (
                    <div className="wow-audit-pills">
                      {item.flags.map((flag, index) => (
                        <span className={look ? "wow-pill flag look" : "wow-pill flag"} key={`${item.id}-${flag.type}-${index}`}>
                          {flagLabel(flag)}
                        </span>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    className="wow-audit-plan"
                    aria-pressed={marked}
                    aria-label={marked ? `Planned to cancel ${item.name}` : `Plan to cancel ${item.name}`}
                    data-testid="wow-subscription-audit-plan"
                    onClick={() => wow.update((current) => togglePlanned(current, item.id))}
                  >
                    {marked ? "Planned ✓" : "Plan to cancel"}
                  </button>
                </li>
              );
            })}
          </ul>
          {audit.plannedSavingsYearlyPaise > 0 && (
            <p className="wow-audit-save" data-testid="wow-subscription-audit-save">
              Cancel the planned ones and save <Amount>{formatINR(audit.plannedSavingsYearlyPaise)}</Amount> a year
            </p>
          )}
          <p className="wow-audit-foot">Lakshly never cancels anything for you. Cancel in the app or site you pay.</p>
        </>
      )}
    </Glass>
  );
}
