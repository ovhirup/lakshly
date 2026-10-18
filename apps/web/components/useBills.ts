"use client";

import { useMemo } from "react";
import { useData } from "@/components/DataState";
import { buildRadar, radarSummary } from "@/lib/bills/radar";
import { buildAudit } from "@/lib/wow/subscription-audit";

/** Bill radar follows the active dataset and its encrypted wow preferences. */
export function useBills() {
  const { accounts, debts, sips, transactions, review, wow } = useData();
  const bills = useMemo(() => {
    const plannedCancels = new Set(wow.state.plannedCancels);
    const subscriptions = buildAudit(transactions, review.now, plannedCancels).items;
    return buildRadar({
      accounts, debts, sips, fees: wow.state.fees, subscriptions, plannedCancels,
      state: wow.state.bills, now: review.now,
    });
  }, [accounts, debts, sips, transactions, review.now, wow.state]);
  const summary = useMemo(() => radarSummary(bills), [bills]);
  return {
    bills, summary, state: wow.state.bills,
    markBillPaid: wow.markBillPaid,
    unmarkBillPaid: wow.unmarkBillPaid,
    toggleBillMute: wow.toggleBillMute,
    setBillAlerts: wow.setBillAlerts,
    setBillLeadDays: wow.setBillLeadDays,
    setBillAmountsInAlerts: wow.setBillAmountsInAlerts,
  };
}
