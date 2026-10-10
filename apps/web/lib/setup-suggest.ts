// Setup wizard suggestions: a starter monthly budget and a first goal. Pure, integer paise maths.
import type { Account, Category, Transaction } from "./schema.gen";
import type { SetupGoal } from "./setup";
import { CURRENCIES, type CurrencyCode } from "./currencies.gen";

/** Thresholds come from the shared currency table (minor units). INR is the default so existing behaviour is unchanged. */
const mag = (currency: CurrencyCode) => CURRENCIES[currency].magnitude;

/** Categories that move month to month. Fixed costs (rent, EMIs, insurance, SIPs, fees) are planned elsewhere. */
export const VARIABLE_CATEGORIES: Category[] = ["groceries", "dining", "transport", "fuel", "shopping", "entertainment", "travel", "health", "utilities", "gifts", "cash", "other"];
export const MIN_LINE = CURRENCIES.INR.magnitude.minBudgetLine; // ₹500 in paise (INR default)
export type Preset = "comfortable" | "balanced" | "ambitious";
export const PRESET_FACTOR: Record<Preset, number> = { comfortable: 100, balanced: 95, ambitious: 90 };

const isFundLedger = (t: Transaction) => !!t.tags?.some((x) => x.startsWith("units:"));
const monthOf = (d: string) => d.slice(0, 7);
const prevMonth = (ym: string) => { const [y, m] = ym.split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`; };

/** Median of integers; even counts take the lower-middle + upper-middle mean, floored. */
export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : Math.floor((s[mid - 1] + s[mid]) / 2);
}

/** Apply a percentage and round half-up: to ₹100 below ₹5,000, to ₹500 at or above. Integer maths only. */
export function roundBudget(paise: number, factor = 100, currency: CurrencyCode = "INR"): number {
  const m = mag(currency);
  const scaled = paise * factor; // paise × 100
  const step = scaled < m.budgetStepThreshold * 100 ? m.budgetStepSmall : m.budgetStepLarge; // ₹100 or ₹500 for INR, in paise
  const unit = step * 100;
  return Math.floor((scaled + unit / 2) / unit) * step;
}

/** Months strictly before `today`'s month that have any transactions; the latest `max` of them. */
export function completeMonths(txns: Transaction[], today: string, max = 3): string[] {
  const current = monthOf(today);
  const have = new Set(txns.map((t) => monthOf(t.date)));
  const out: string[] = [];
  let m = prevMonth(current);
  for (let i = 0; i < 24 && out.length < max; i++, m = prevMonth(m)) if (have.has(m)) out.push(m);
  return out.reverse();
}

export interface BudgetLine { category: Category; median: number; suggested: number }
export interface BudgetSuggestion { mode: "history" | "starter"; months: string[]; confidence: "low" | "ok"; lines: BudgetLine[] }

/** Starter amounts when there is no complete month yet (round, editable placeholders). */

export function suggestBudget(txns: Transaction[], today: string, opts: { maxLines?: number | null; preset?: Preset; currency?: CurrencyCode } = {}): BudgetSuggestion {
  const currency = opts.currency ?? "INR";
  const m = mag(currency);
  /** Starter amounts when there is no complete month yet (round, editable placeholders). */
  const STARTER = m.starterBudgets as readonly (readonly [Category, number])[];
  const factor = PRESET_FACTOR[opts.preset ?? "balanced"];
  const max = opts.maxLines ?? Infinity;
  const ms = completeMonths(txns, today);
  if (!ms.length) {
    return { mode: "starter", months: [], confidence: "low", lines: STARTER.slice(0, max).map(([category, v]) => ({ category, median: 0, suggested: roundBudget(v, factor, currency) })) };
  }
  const spend = new Map<Category, Map<string, number>>();
  for (const t of txns) {
    if (t.amount >= 0 || isFundLedger(t) || !VARIABLE_CATEGORIES.includes(t.category)) continue;
    const m = monthOf(t.date);
    if (!ms.includes(m)) continue;
    const per = spend.get(t.category) ?? new Map<string, number>();
    per.set(m, (per.get(m) ?? 0) - t.amount);
    spend.set(t.category, per);
  }
  const lines = [...spend.entries()]
    .map(([category, per]) => ({ category, median: median(ms.map((m) => per.get(m) ?? 0)) }))
    .filter((l) => l.median >= m.minBudgetLine)
    .sort((a, b) => b.median - a.median || a.category.localeCompare(b.category))
    .slice(0, max)
    .map((l) => ({ ...l, suggested: roundBudget(l.median, factor, currency) }));
  return { mode: "history", months: ms, confidence: ms.length >= 3 ? "ok" : "low", lines };
}

/** Budget ids are deterministic so saving again replaces the same lines. */
export function budgetId(month: string, category: Category): string {
  return `bud_${month.replace("-", "")}${category}`;
}

/* ───────────── first goal ───────────── */

const LIQUID: Account["type"][] = ["savings", "current", "wallet", "cash"];
const ceilTo = (paise: number, step: number) => Math.ceil(paise / step) * step;
const monthsBetween = (from: string, to: string) => {
  const [a, b] = [from, to].map((d) => { const [y, m] = d.split("-").map(Number); return y * 12 + m; });
  return Math.max(1, b - a);
};

export interface GoalFacts { monthlySpend: number; liquid: number; annual?: { name: string; amount: number; due: string } }

/** Average monthly outflow (everything except investments, transfers and fund ledgers) over complete months. */
export function goalFacts(txns: Transaction[], accounts: Account[], today: string, currency: CurrencyCode = "INR"): GoalFacts {
  const ms = completeMonths(txns, today);
  const out = txns.filter((t) => t.amount < 0 && !isFundLedger(t) && ms.includes(monthOf(t.date)) && t.category !== "investments" && t.category !== "transfers");
  const monthlySpend = ms.length ? Math.round(out.reduce((s, t) => s - t.amount, 0) / ms.length) : 0;
  const liquid = accounts.filter((a) => LIQUID.includes(a.type)).reduce((s, a) => s + Math.max(0, a.balance), 0);
  // A yearly insurance-style payment ≥ ₹5,000 seen 6–12 months ago is due again within the next 6 months.
  const yearAgo = txns
    .filter((t) => t.amount <= -mag(currency).annualPaymentThreshold && t.category === "insurance")
    .map((t) => ({ t, due: `${Number(t.date.slice(0, 4)) + 1}${t.date.slice(4)}` }))
    .filter(({ due }) => due > today && monthsBetween(today, due) <= 6)
    .sort((a, b) => a.due.localeCompare(b.due))[0];
  return { monthlySpend, liquid, annual: yearAgo ? { name: yearAgo.t.merchant ?? "Yearly payment", amount: -yearAgo.t.amount, due: yearAgo.due } : undefined };
}

/**
 * emergency3 when liquid savings cover < 3 months of spend; else an upcoming yearly payment; else
 * emergency6 when < 6 months; else a custom goal. Targets round up to ₹1,000, monthly to ₹100, over 12 months.
 */
export function suggestGoal(f: GoalFacts, today: string, now: string, currency: CurrencyCode = "INR"): SetupGoal {
  const { goalTargetRounding, goalMonthlyRounding, customGoalDefault } = mag(currency);
  if (f.monthlySpend > 0 && f.liquid < 3 * f.monthlySpend) {
    const target = ceilTo(3 * f.monthlySpend, goalTargetRounding);
    return { kind: "emergency3", name: "Emergency fund · 3 months", target, monthly: ceilTo(Math.max(0, target - f.liquid) / 12, goalMonthlyRounding), createdAt: now };
  }
  if (f.annual) {
    const target = ceilTo(f.annual.amount, goalTargetRounding);
    return { kind: "annualPayment", name: `Set aside for ${f.annual.name}`, target, monthly: ceilTo(target / monthsBetween(today, f.annual.due), goalMonthlyRounding), due: f.annual.due, createdAt: now };
  }
  if (f.monthlySpend > 0 && f.liquid < 6 * f.monthlySpend) {
    const target = ceilTo(6 * f.monthlySpend, goalTargetRounding);
    return { kind: "emergency6", name: "Emergency fund · 6 months", target, monthly: ceilTo(Math.max(0, target - f.liquid) / 12, goalMonthlyRounding), createdAt: now };
  }
  return { kind: "custom", name: "Something I'm saving for", target: customGoalDefault, monthly: ceilTo(customGoalDefault / 12, goalMonthlyRounding), createdAt: now };
}
