"use client";
import { useState } from "react";
import Link from "next/link";
import { useAppState } from "@/components/AppState";
import { useData } from "@/components/DataState";
import { Icon } from "@/components/Icon";
import { Amount } from "@/components/Privacy";
import { useBills } from "@/components/useBills";
import { useTier } from "@/components/useTier";
import { Chips, Glass, PageHeader, PremiumBadge } from "@/components/ui";
import { BILL_KINDS, dueText } from "@/lib/bills/radar";
import { billsToIcs } from "@/lib/bills/ics";
import { formatDate, formatINR } from "@/lib/format";
import { IS_BETA } from "@/lib/edition";
import "../bills.css";

export function BillRadar() {
  const { bills, summary, state, markBillPaid, unmarkBillPaid, toggleBillMute, setBillAlerts, setBillLeadDays, setBillAmountsInAlerts } = useBills();
  const { review } = useData();
  const { can, limit } = useTier();
  const { setPlan } = useAppState();
  const [blocked, setBlocked] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const maximum = limit("bills.alerts");
  const eligible = bills.filter((bill) => !bill.paid && !bill.muted);
  const allowed = new Set(eligible.slice(0, maximum ?? undefined).map((bill) => bill.id));
  const lockedCount = Math.max(0, eligible.length - allowed.size);
  const groups = [
    { title: "Today", items: bills.filter((bill) => bill.daysLeft === 0) },
    { title: "This week", items: bills.filter((bill) => bill.daysLeft >= 1 && bill.daysLeft <= 6) },
    { title: "Later", items: bills.filter((bill) => bill.daysLeft >= 7) },
  ];

  async function changeAlerts(enabled: boolean) {
    if (!enabled) { setBillAlerts(false); return; }
    if (typeof Notification === "undefined") { setBlocked(true); setBillAlerts(false); return; }
    setRequesting(true);
    try {
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      setBlocked(permission !== "granted");
      setBillAlerts(permission === "granted");
    } catch { setBlocked(true); setBillAlerts(false); }
    finally { setRequesting(false); }
  }

  function downloadCalendar() {
    const text = billsToIcs(bills, allowed, review.now, { leadDays: state.leadDays, amountsInAlerts: state.amountsInAlerts });
    const url = URL.createObjectURL(new Blob([text], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "lakshly-bills.ics";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (!can("bills.radar")) return null;
  return (
    <>
      <div data-testid="bills-page" className="bills-page">
        <PageHeader title="Bill radar" subtitle="Card dues, EMIs, insurance, fees and subscriptions in the next 45 days">
          <button type="button" className="btn" data-testid="bills-ics" onClick={downloadCalendar}>Add to calendar (.ics)</button>
        </PageHeader>
        <Glass className="card bills-summary" data-testid="bills-summary">
          <div><p className="eyebrow">{summary.dueThisWeek} due this week</p><strong className="bills-total"><Amount>{formatINR(summary.dueThisWeekPaise)}</Amount></strong></div>
          <div className="bills-next"><span className="muted tiny">Next bill</span><p>{summary.next ? summary.next.name : "All caught up"}</p>{summary.next && <span className="muted tiny">{dueText(summary.next.daysLeft)} · {formatDate(summary.next.due)}</span>}</div>
        </Glass>
        {bills.length === 0 ? <Glass className="card"><p>Nothing due in the next 45 days</p></Glass> : groups.map((group) => group.items.length > 0 && (
          <Glass className="card bills-group" key={group.title} aria-label={group.title}>
            <h2>{group.title}</h2>
            <ul className="bills-list">{group.items.map((bill) => (
              <li className={`bills-row${bill.paid ? " bills-paid" : ""}`} data-testid="bills-row" key={bill.id}>
                <div className="bills-detail"><span className="bills-kind"><Icon name={bill.kind === "card" ? "credit" : bill.kind === "insurance" ? "shield" : "history"} size={14} />{BILL_KINDS[bill.kind].title}</span><h3>{bill.name}</h3><p className="muted tiny">{dueText(bill.daysLeft)} · {formatDate(bill.due)}{bill.paid ? " · Paid ✓" : ""}</p></div>
                <span className="bills-amount">{bill.amount === null ? "—" : <Amount>{formatINR(bill.amount)}</Amount>}</span>
                <div className="bills-actions"><button type="button" className="btn" data-testid="bills-mark-paid" aria-label={`${bill.paid ? "Undo paid for" : "Mark paid for"} ${bill.name}`} onClick={() => bill.paid ? unmarkBillPaid(bill.id) : markBillPaid(bill.id)}>{bill.paid ? "Undo" : "Mark paid"}</button><button type="button" className="btn ghost" data-testid="bills-mute" aria-label={`Alerts for ${bill.name}`} aria-pressed={!bill.muted} onClick={() => toggleBillMute(bill.kind, bill.sourceId)}><Icon name="bell" size={16} />{bill.muted ? "Alerts off" : "Alerts on"}</button></div>
              </li>
            ))}</ul>
          </Glass>
        ))}
      </div>
      <Glass className="card bills-alerts" data-testid="bills-alerts">
        <h2>Alerts</h2>
        <label className="bills-setting"><span>Bill alerts</span><input type="checkbox" checked={state.alertsOn} disabled={requesting} onChange={(event) => { void changeAlerts(event.target.checked); }} /></label>
        {blocked && <p className="muted tiny" role="status">Your browser blocked notifications. You can still see everything here.</p>}
        <p className="muted tiny">Remind me</p>
        <Chips label="Bill alert lead days" value={String(state.leadDays)} options={[1, 3, 7].map((days) => ({ value: String(days), label: `${days} ${days === 1 ? "day" : "days"} before` }))} onChange={(value) => setBillLeadDays(Number(value))} />
        <label className="bills-setting"><span>Show amounts in alerts</span><input type="checkbox" checked={state.amountsInAlerts} onChange={(event) => setBillAmountsInAlerts(event.target.checked)} /></label>
        <p className="tiny muted">Alerts appear while Lakshly is open. Nothing leaves this device.</p>
        {maximum === 3 && <p className="tiny muted">Free shows alerts for your next 3 bills</p>}
        {lockedCount > 0 && maximum === 3 && <div className="bills-locked" data-testid="bills-locked"><div className="card-head"><h3>{lockedCount} more bills won’t alert you</h3><PremiumBadge small /></div>{IS_BETA ? <button type="button" className="btn primary" onClick={() => setPlan("premium")}>Preview Premium (demo)</button> : <p className="tiny muted">Payments aren’t live yet.</p>}</div>}
      </Glass>
    </>
  );
}

export function NextBillsCard() {
  const { bills } = useBills();
  const { can } = useTier();
  if (!can("bills.radar")) return null;
  const next = bills.filter((bill) => !bill.paid).slice(0, 3);
  return <Glass className="card bills-overview" data-testid="bills-overview"><div className="card-head"><h2>Next bills</h2><Link href="/bills/">Open bill radar</Link></div>{next.length ? <ul className="bills-list">{next.map((bill) => <li className="bills-overview-row" key={bill.id}><div><strong>{bill.name}</strong><p className="muted tiny">{dueText(bill.daysLeft)}</p></div><span>{bill.amount === null ? "—" : <Amount>{formatINR(bill.amount)}</Amount>}</span></li>)}</ul> : <p className="muted">Nothing due in the next 45 days</p>}</Glass>;
}
