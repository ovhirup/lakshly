// Pure payoff date. Amounts are paise. No React.
import type { Debt } from "../schema.gen";
import { extraPaiseMax } from "./state";

export interface DebtPayoff {
  id: string;
  name: string;
  /** yyyy-MM of the payment that clears this debt. Null when it never clears. */
  month: string | null;
}

export interface FreedomPlan {
  /** Month of the final payment. Null when a scheduled debt never clears. */
  freedomMonth: string | null;
  /** Months simulated. The payoff length when freedomMonth is set, otherwise the cap (600). */
  months: number;
  payoffs: DebtPayoff[];
  totalInterestPaise: number;
  /** Debts left out of the date: no balance, or no EMI (for example a family loan). */
  unscheduled: Debt[];
}

/** Days until the 1st of the month after a freedom month. */
export interface FreedomCountdown {
  days: number;
}

export const maxMonths = 600;

/** ₹500, in paise. The what-if slider steps by this. */
export const extraStepPaise = 50_000;

const SAFE = Number.MAX_SAFE_INTEGER;

interface Slot {
  id: string;
  name: string;
  emi: number;
  annualRatePct: number;
  balance: number;
  payoff: string | null;
}

/** yyyy-MM for the review clock (pinned demo clock, or the real clock for My data). */
export function startMonth(now: Date): string {
  const year = now.getFullYear();
  const month = Math.min(12, Math.max(1, now.getMonth() + 1));
  return formatMonth(year, month);
}

/**
 * Only debts with outstanding > 0 and emi > 0 are scheduled.
 * Each month: interest balance * annualRatePct / 1200 (nearest paise), then the EMI.
 * extraPaise, plus rolled EMIs of debts cleared in earlier months, goes to one avalanche
 * target (highest rate, then smallest balance). Leftover extra moves to the next target
 * in the same month. A debt whose EMI never reduces the balance, and which gets no
 * rescuing extra, leaves freedomMonth null.
 */
export function simulate(debts: readonly Debt[], from: string, extraPaise: number, rollOver: boolean): FreedomPlan {
  const extra = typeof extraPaise === "number" && Number.isFinite(extraPaise) ? Math.max(0, Math.trunc(extraPaise)) : 0;
  const unscheduled = debts.filter((debt) => debt.outstanding <= 0 || debt.emi <= 0);
  const slots: Slot[] = [];
  for (const debt of debts) {
    if (debt.outstanding <= 0 || debt.emi <= 0) continue;
    slots.push({
      id: debt.id,
      name: debt.name,
      emi: debt.emi,
      annualRatePct: debt.annualRatePct,
      balance: debt.outstanding,
      payoff: null,
    });
  }
  if (parseMonth(from) === null) {
    return { freedomMonth: null, months: 0, payoffs: [], totalInterestPaise: 0, unscheduled: [...debts] };
  }
  if (slots.length === 0) {
    return { freedomMonth: null, months: 0, payoffs: [], totalInterestPaise: 0, unscheduled };
  }

  let totalInterest = 0;
  let rolled = 0;
  let freedomMonth: string | null = null;
  let monthsRun = 0;

  for (let offset = 0; offset < maxMonths; offset++) {
    const current = shift(from, offset);
    if (!current) break;
    monthsRun = offset + 1;

    for (const slot of slots) {
      if (slot.balance <= 0) continue;
      const interest = interestPaise(slot.balance, slot.annualRatePct);
      totalInterest = add(totalInterest, interest);
      const owed = add(slot.balance, interest);
      const payment = Math.min(owed, slot.emi);
      slot.balance = owed - payment;
      if (slot.balance === 0) slot.payoff = current;
    }

    let pool = add(extra, rollOver ? rolled : 0);
    while (pool > 0) {
      const target = avalancheIndex(slots);
      if (target === null) break;
      const payment = Math.min(pool, slots[target].balance);
      if (payment === 0) break;
      slots[target].balance -= payment;
      pool -= payment;
      if (slots[target].balance === 0) slots[target].payoff = current;
    }

    if (slots.every((slot) => slot.balance === 0)) {
      freedomMonth = current;
      break;
    }
    if (rollOver) {
      rolled = slots.reduce((sum, item) => (item.balance === 0 ? add(sum, item.emi) : sum), 0);
    }
  }

  return {
    freedomMonth,
    months: monthsRun,
    payoffs: slots.map((slot) => ({ id: slot.id, name: slot.name, month: slot.payoff })),
    totalInterestPaise: totalInterest,
    unscheduled,
  };
}

/** Months the what-if date sits ahead of the baseline. Zero when either date is missing. */
export function pullIn(baseline: FreedomPlan, whatIf: FreedomPlan): number {
  if (!baseline.freedomMonth || !whatIf.freedomMonth) return 0;
  const baseIndex = monthIndex(baseline.freedomMonth);
  const fasterIndex = monthIndex(whatIf.freedomMonth);
  if (baseIndex === null || fasterIndex === null) return 0;
  return Math.max(0, baseIndex - fasterIndex);
}

/** Interest the what-if plan avoids, in paise. Never negative. */
export function interestSaved(baseline: FreedomPlan, whatIf: FreedomPlan): number {
  return Math.max(0, baseline.totalInterestPaise - whatIf.totalInterestPaise);
}

/** sum(principal - outstanding) / sum(principal) across every debt. Zero when there is no principal. */
export function clearedFraction(debts: readonly Debt[]): number {
  let principal = 0;
  let cleared = 0;
  for (const debt of debts) {
    principal += debt.principal;
    cleared += debt.principal - debt.outstanding;
  }
  if (principal <= 0) return 0;
  return cleared / principal;
}

/** Days from now until the 1st of the month after `month`, in the local calendar. Never negative. */
export function countdown(month: string, now: Date): FreedomCountdown {
  const next = shift(month, 1);
  if (!next) return { days: 0 };
  const parsed = parseMonth(next);
  if (!parsed) return { days: 0 };
  const target = new Date(parsed.year, parsed.month - 1, 1);
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((target.getTime() - from.getTime()) / 86_400_000);
  return { days: Math.max(0, days) };
}

export function message(months: number): string {
  if (months < 1) return "Steady and sure, the tortoise also won 🐢";
  if (months === 1) return "1 month sooner, nice nudge 🎉";
  if (months <= 5) return `${months} months sooner, nice nudge 🎉`;
  if (months <= 11) return `${months} months sooner, half a year back in your pocket 🚀`;
  return `${months} months sooner, freedom speedrun unlocked 🏁`;
}

/**
 * Slider ceiling: 2× the scheduled EMI, rounded up to a ₹500 step, and never below ₹500.
 * Scheduled means outstanding and EMI are both above zero.
 */
export function extraSliderMaximum(debts: readonly Debt[]): number {
  const doubled = saturatingDouble(scheduledEMI(debts));
  return Math.max(extraStepPaise, ceilToStep(doubled, extraStepPaise));
}

/** True when a scheduled EMI is at or below one month of interest, so the balance never falls. */
export function emiDoesNotCoverInterest(debt: Debt): boolean {
  if (debt.outstanding <= 0 || debt.emi <= 0) return false;
  return debt.emi <= interestPaise(debt.outstanding, debt.annualRatePct);
}

export const noLoansCopy = "No loans. You are already free 🎉";

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Baseline plan: no extra payment, cleared EMIs stay put. */
export function baseline(debts: readonly Debt[], now: Date): FreedomPlan {
  return simulate(debts, startMonth(now), 0, false);
}

/** "2028-10" -> "Oct 2028". Anything that is not yyyy-MM comes back unchanged. */
export function monthLabel(yyyyMM: string): string {
  const parts = yyyyMM.split("-");
  if (parts.length !== 2 || !/^\d+$/.test(parts[0]) || !/^\d+$/.test(parts[1])) return yyyyMM;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (month < 1 || month > 12) return yyyyMM;
  return `${SHORT_MONTHS[month - 1]} ${year}`;
}

/** "762 days", "1 day". Never negative. Groups thousands with commas. */
export function dayCount(days: number): string {
  const count = Number.isFinite(days) ? Math.max(0, Math.trunc(days)) : 0;
  const label = count === 1 ? "day" : "days";
  return `${groupThousands(count)} ${label}`;
}

export function payoffLabel(month: string | null): string {
  return month ? monthLabel(month) : "Not clearing";
}

export function unscheduledNote(name: string): string {
  return `Also tracked: ${name} (no fixed schedule)`;
}

export function soonerText(months: number): string {
  return months === 1 ? "1 month sooner" : `${months} months sooner`;
}

export function whatIfDateLine(plan: FreedomPlan): string {
  return plan.freedomMonth ? `Debt-free by ${monthLabel(plan.freedomMonth)}` : "No freedom date yet";
}

/** Rounded 0–100 share of principal already paid. */
export function clearedPercent(debts: readonly Debt[]): number {
  const clamped = Math.min(1, Math.max(0, clearedFraction(debts)));
  return Math.round(clamped * 100);
}

/**
 * Slider ceiling: the ₹500 grid of 2× scheduled EMI, and never above the stored extra cap.
 */
export function sliderCeiling(debts: readonly Debt[]): number {
  const cap = Math.floor(extraPaiseMax / extraStepPaise) * extraStepPaise;
  return Math.min(cap, extraSliderMaximum(debts));
}

export interface FreedomHeadline {
  title: string | null;
  days: string | null;
  stuck: string[];
}

/** Big line on the freedom card. `days` is set only when a freedom month exists. */
export function freedomHeadline(debts: readonly Debt[], plan: FreedomPlan, now: Date): FreedomHeadline {
  if (plan.freedomMonth) {
    return {
      title: `Debt-free by ${monthLabel(plan.freedomMonth)}`,
      days: `${dayCount(countdown(plan.freedomMonth, now).days)} to go`,
      stuck: [],
    };
  }
  if (plan.payoffs.length === 0) return { title: "No fixed EMI yet", days: null, stuck: [] };
  return { title: null, days: null, stuck: stuckLines(debts, plan) };
}

/**
 * One line per scheduled debt that never clears.
 * The card uses the fallback sentence. The what-if card passes fallback false.
 */
export function stuckLines(debts: readonly Debt[], plan: FreedomPlan, fallback = true): string[] {
  const lines = plan.payoffs.filter((payoff) => payoff.month === null).map((payoff) => {
    const debt = debts.find((item) => item.id === payoff.id);
    if (debt && emiDoesNotCoverInterest(debt)) return `${payoff.name}: the EMI does not cover interest.`;
    return `${payoff.name} is not clearing on this EMI yet.`;
  });
  if (lines.length > 0 || !fallback) return lines;
  return ["This plan is not clearing yet."];
}

/** One slim line for Overview. Empty debts get the already-free sentence. */
export function overviewLine(debts: readonly Debt[], now: Date): string {
  if (debts.length === 0) return noLoansCopy;
  const plan = baseline(debts, now);
  if (plan.freedomMonth) {
    return `Debt-free by ${monthLabel(plan.freedomMonth)} · ${dayCount(countdown(plan.freedomMonth, now).days)}`;
  }
  const summary = stuckSummary(debts, plan);
  if (summary) return summary;
  if (plan.payoffs.length === 0) return "No fixed EMI yet";
  return "This plan is not clearing yet";
}

function stuckSummary(debts: readonly Debt[], plan: FreedomPlan): string | null {
  const open = plan.payoffs.filter((payoff) => payoff.month === null);
  if (open.length === 0) return null;
  const uncovered = open.filter((payoff) => {
    const debt = debts.find((item) => item.id === payoff.id);
    return debt ? emiDoesNotCoverInterest(debt) : false;
  });
  if (uncovered.length === 1) return `${uncovered[0].name}: the EMI does not cover interest.`;
  if (uncovered.length > 0) return "An EMI does not cover interest.";
  if (open.length === 1) return `${open[0].name} is not clearing on this EMI yet.`;
  return "This plan is not clearing yet";
}

function groupThousands(value: number): string {
  const digits = String(value);
  let out = "";
  for (let index = 0; index < digits.length; index++) {
    const fromEnd = digits.length - index;
    if (index > 0 && fromEnd % 3 === 0) out += ",";
    out += digits[index];
  }
  return out;
}

function avalancheIndex(slots: readonly Slot[]): number | null {
  let best: number | null = null;
  for (let index = 0; index < slots.length; index++) {
    if (slots[index].balance <= 0) continue;
    if (best === null) {
      best = index;
      continue;
    }
    const current = slots[best];
    const slot = slots[index];
    if (slot.annualRatePct > current.annualRatePct
      || (slot.annualRatePct === current.annualRatePct && slot.balance < current.balance)) {
      best = index;
    }
  }
  return best;
}

/** Nearest paise, half away from zero. Matches the reducing-balance formula in Debt. */
function interestPaise(balance: number, annualRatePct: number): number {
  if (balance <= 0 || annualRatePct <= 0) return 0;
  const raw = (balance * annualRatePct) / 1200;
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  if (raw >= SAFE) return SAFE;
  return Math.round(raw);
}

function add(lhs: number, rhs: number): number {
  const sum = lhs + rhs;
  if (!Number.isFinite(sum) || sum > SAFE) return SAFE;
  return sum;
}

function scheduledEMI(debts: readonly Debt[]): number {
  return debts.reduce((sum, debt) => {
    if (debt.outstanding <= 0 || debt.emi <= 0) return sum;
    return add(sum, debt.emi);
  }, 0);
}

function saturatingDouble(value: number): number {
  if (value <= 0) return 0;
  if (value > Math.floor(SAFE / 2)) return SAFE;
  return value * 2;
}

/** Smallest multiple of step that is at least value. Zero stays zero. */
function ceilToStep(value: number, step: number): number {
  if (value <= 0 || step <= 0) return 0;
  const remainder = value % step;
  if (remainder === 0) return value;
  const gap = step - remainder;
  if (value > SAFE - gap) return Math.floor(SAFE / step) * step;
  return value + gap;
}

function parseMonth(text: string): { year: number; month: number } | null {
  const parts = text.split("-");
  if (parts.length !== 2) return null;
  if (!/^\d+$/.test(parts[0]) || !/^\d+$/.test(parts[1])) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || year <= 0 || month < 1 || month > 12) return null;
  return { year, month };
}

function monthIndex(text: string): number | null {
  const parsed = parseMonth(text);
  if (!parsed) return null;
  return parsed.year * 12 + (parsed.month - 1);
}

function shift(text: string, offset: number): string | null {
  const index = monthIndex(text);
  if (index === null) return null;
  const next = index + offset;
  if (next < 0) return null;
  return formatMonth(Math.floor(next / 12), (next % 12) + 1);
}

function formatMonth(year: number, month: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}
