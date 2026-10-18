import { daysUntil } from "@/lib/card-due";
import { formatINR } from "@/lib/format";
import { runwayPlan } from "@/lib/wow/fee-runway";
import type { WowFee } from "@/lib/wow/state";
import type { SubscriptionItem } from "@/lib/wow/subscription-audit";
import type { accounts, debts, sips } from "@/lib/data";

export type BillKind = "card" | "emi" | "insurance" | "fee" | "subscription" | "sip";
export const BILL_KINDS: Record<BillKind, { title: string; rank: number }> = {
  card: { title: "Card bill", rank: 0 },
  emi: { title: "EMI", rank: 1 },
  insurance: { title: "Insurance", rank: 2 },
  fee: { title: "Fee", rank: 3 },
  subscription: { title: "Subscription", rank: 4 },
  sip: { title: "SIP", rank: 5 },
};

export interface RadarBill {
  id: string;
  sourceId: string;
  kind: BillKind;
  name: string;
  due: string;
  daysLeft: number;
  amount: number | null;
  paid: boolean;
  muted: boolean;
}

export interface BillRadarState {
  paid: string[];
  muted: string[];
  leadDays: number;
  alertsOn: boolean;
  amountsInAlerts: boolean;
}

export function emptyBillState(): BillRadarState {
  return { paid: [], muted: [], leadDays: 3, alertsOn: false, amountsInAlerts: false };
}

export function normaliseBillState(raw: unknown): BillRadarState {
  try {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyBillState();
    const r = raw as Partial<BillRadarState>;
    const strings = (v: unknown): string[] => Array.isArray(v) && v.every((s) => typeof s === "string") ? [...new Set(v as string[])] : [];
    const tail = (s: string) => s.split(":").filter(Boolean).at(-1) ?? "";
    const paid = strings(r.paid).sort((a, b) => compare(tail(a), tail(b)) || compare(a, b)).slice(-200).sort();
    return {
      paid,
      muted: strings(r.muted).sort(),
      leadDays: r.leadDays === 1 || r.leadDays === 7 ? r.leadDays : 3,
      alertsOn: r.alertsOn === true,
      amountsInAlerts: r.amountsInAlerts === true,
    };
  } catch {
    return emptyBillState();
  }
}

export const HORIZON_DAYS = 45;
const DAY_MS = 86400000;
const IST_MS = 19800000;
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const ymd = (date: Date) => date.toISOString().slice(0, 10);
const todayInIndia = (date: Date) => ymd(new Date(date.getTime() + IST_MS));

function day(text: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const value = new Date(text + "T00:00:00Z");
  return Number.isFinite(value.getTime()) && ymd(value) === text ? value : null;
}

/** Add months to the original date, clamping the day rather than accumulating drift. */
function addMonths(original: Date, months: number): Date {
  const month = new Date(original.getTime());
  month.setUTCDate(1);
  month.setUTCMonth(month.getUTCMonth() + months);
  const last = new Date(month.getTime());
  last.setUTCMonth(last.getUTCMonth() + 1);
  last.setUTCDate(0);
  month.setUTCDate(Math.min(original.getUTCDate(), last.getUTCDate()));
  return month;
}

function nextDue(n: number, today: Date): Date | null {
  if (!Number.isInteger(n) || n < 1 || n > 31) return null;
  for (let offset = 0; offset <= 14; offset++) {
    // Use a known long month as the anchor so the requested day survives clamping.
    const anchor = new Date(today.getTime());
    anchor.setUTCDate(1);
    anchor.setUTCMonth(0);
    anchor.setUTCDate(n);
    const due = addMonths(anchor, today.getUTCMonth() + offset);
    if (due >= today) return due;
  }
  return null;
}

export interface RadarInput {
  accounts: readonly (typeof accounts)[number][];
  debts: readonly (typeof debts)[number][];
  sips: readonly (typeof sips)[number][];
  fees: readonly WowFee[];
  subscriptions: readonly SubscriptionItem[];
  plannedCancels: ReadonlySet<string>;
  state: BillRadarState;
  now: Date;
}

export function buildRadar(input: RadarInput): RadarBill[] {
  const { accounts, debts, sips, fees, subscriptions, plannedCancels, state, now } = input;
  const today = day(todayInIndia(now))!;
  const bills: RadarBill[] = [];
  const paid = new Set(state.paid);
  const muted = new Set(state.muted);
  const append = (sourceId: string, kind: BillKind, name: string, due: Date | null, amount: number | null) => {
    if (!due) return;
    const date = ymd(due);
    const daysLeft = daysUntil(ymd(today), date);
    if (daysLeft < 0 || daysLeft > HORIZON_DAYS) return;
    const id = kind + ":" + sourceId + ":" + date;
    bills.push({ id, sourceId, kind, name, due: date, daysLeft, amount, paid: paid.has(id), muted: muted.has(kind + ":" + sourceId) });
  };
  for (const account of accounts) {
    if (account.type !== "credit_card" || (account.balance === 0 && account.dueDay == null)) continue;
    append(account.id, "card", account.name, nextDue(account.dueDay ?? 1, today), Math.abs(account.balance));
  }
  for (const debt of debts) {
    if (debt.emi <= 0 || debt.outstanding <= 0) continue;
    const text = debt.startDate.split("-").at(-1) ?? "";
    if (!/^[+-]?\d+$/.test(text)) continue;
    append(debt.id, "emi", debt.name, nextDue(Number(text), today), debt.emi);
  }
  for (const sip of sips) {
    if (sip.status === "active") append(sip.id, "sip", sip.scheme, nextDue(sip.dayOfMonth, today), sip.amount);
  }
  for (const fee of runwayPlan(fees, {}, now).fees) {
    const name = fee.name.toLowerCase();
    const insurance = name.split(/[^\p{L}]+/u).includes("lic") || ["insurance", "insur", "policy", "mediclaim", "term plan"].some((word) => name.includes(word));
    append(fee.id, insurance ? "insurance" : "fee", fee.name, day(fee.due), fee.amount);
  }
  for (const item of subscriptions) {
    if (item.lapsed || plannedCancels.has(item.id) || !item.nextDate) continue;
    const original = day(item.nextDate);
    if (!original) continue;
    let due = original;
    let offset = 0;
    while (due < today) {
      const step = { weekly: 7, monthly: 1, quarterly: 3, yearly: 12, irregular: 0 }[item.cadence];
      if (!step) break;
      offset += step;
      const next = item.cadence === "weekly" ? new Date(original.getTime() + offset * DAY_MS) : addMonths(original, offset);
      if (!Number.isFinite(next.getTime()) || next <= due) break;
      due = next;
    }
    append(item.id, "subscription", item.name, due, item.typicalPaise);
  }
  return bills.sort((a, b) => a.daysLeft - b.daysLeft || BILL_KINDS[a.kind].rank - BILL_KINDS[b.kind].rank || compare(a.name, b.name) || compare(a.id, b.id));
}

export function dueText(daysLeft: number): string {
  return daysLeft === 0 ? "Due today" : daysLeft === 1 ? "Due tomorrow" : "Due in " + daysLeft + " days";
}

export function radarSummary(bills: readonly RadarBill[]) {
  const unpaid = bills.filter((bill) => !bill.paid);
  const week = unpaid.filter((bill) => bill.daysLeft >= 0 && bill.daysLeft <= 6);
  return { dueThisWeek: week.length, dueThisWeekPaise: week.reduce((sum, bill) => sum + (bill.amount ?? 0), 0), next: unpaid[0] ?? null };
}

export interface BillAlert {
  id: string;
  billId: string;
  fireAt: string;
  title: string;
  body: string;
}

export function billAlerts(
  bills: readonly RadarBill[], state: BillRadarState, limit: number | null = null,
  includeAmounts: boolean, now: Date, hour = 9,
): { alerts: BillAlert[]; lockedCount: number } {
  if (!state.alertsOn) return { alerts: [], lockedCount: 0 };
  const eligible = bills.filter((bill) => !bill.paid && !bill.muted);
  const maximum = limit === null ? eligible.length : Math.max(0, Math.trunc(limit));
  const alerts: BillAlert[] = [];
  for (const bill of eligible.slice(0, maximum)) {
    const due = day(bill.due);
    if (!due || !Number.isInteger(hour) || hour < 0 || hour > 23) continue;
    const fallback = due.getTime() - IST_MS + hour * 3600000;
    const first = fallback - state.leadDays * DAY_MS;
    let fire = first > now.getTime() ? first : fallback;
    if (fire <= now.getTime()) {
      if (bill.due !== todayInIndia(now)) continue;
      fire = now.getTime() + 60000;
    }
    const days = daysUntil(todayInIndia(new Date(fire)), bill.due);
    const name = bill.name.replace(/[0-9](?:[0-9 -]*[0-9])?/g, "").trim() || BILL_KINDS[bill.kind].title;
    const shortDay = due.getUTCDate() + " " + ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][due.getUTCMonth()];
    let body = name + " · " + shortDay;
    if (includeAmounts && state.amountsInAlerts && bill.amount !== null) body += " · " + formatINR(bill.amount);
    const shifted = new Date(fire + IST_MS).toISOString();
    const fireAt = shifted.replace(/\.000Z$/, "+05:30").replace(/Z$/, "+05:30");
    alerts.push({ id: "lakshly.bill." + bill.id, billId: bill.id, fireAt, title: BILL_KINDS[bill.kind].title + " " + dueText(days).toLowerCase(), body });
  }
  return { alerts, lockedCount: Math.max(0, eligible.length - maximum) };
}
