import type { Account, Budget, Category, Debt, Sip, Transaction } from "./schema.gen";

const categoryColor = (name: string, fallback: string) => `var(--lk-cat-${name}, ${fallback})`;

export const CATEGORY_COLORS: Record<string, string> = {
  income: categoryColor("income", "var(--lk-income)"),
  groceries: categoryColor("groceries", "var(--lk-income)"),
  dining: categoryColor("dining", "var(--lk-gold-text)"),
  transport: categoryColor("transport", "var(--lk-blue)"),
  fuel: categoryColor("fuel", "var(--lk-spend)"),
  shopping: categoryColor("shopping", "var(--lk-lotus)"),
  utilities: categoryColor("utilities", "var(--lk-indigo)"),
  rent: categoryColor("rent", "var(--lk-danger)"),
  health: categoryColor("health", "var(--lk-invest)"),
  education: categoryColor("education", "var(--lk-indigo)"),
  entertainment: categoryColor("entertainment", "var(--lk-gold-text)"),
  travel: categoryColor("travel", "var(--lk-blue)"),
  subscriptions: categoryColor("subscriptions", "var(--lk-indigo)"),
  insurance: categoryColor("insurance", "var(--lk-text-muted)"),
  investments: categoryColor("investments", "var(--lk-invest)"),
  emi: categoryColor("emi", "var(--lk-spend)"),
  fees: categoryColor("fees", "var(--lk-text-muted)"),
  transfers: categoryColor("transfers", "var(--lk-text-muted)"),
  cash: categoryColor("cash", "var(--lk-text-muted)"),
  gifts: categoryColor("gifts", "var(--lk-lotus)"),
  other: categoryColor("other", "var(--lk-text-muted)"),
};

const LIABILITY = new Set(["credit_card", "loan"]);

export function netWorth(accounts: Account[]) {
  let assets = 0;
  let liabilities = 0;
  for (const a of accounts) {
    if (LIABILITY.has(a.type)) liabilities += Math.abs(Math.min(a.balance, 0));
    else assets += a.balance;
  }
  return { assets, liabilities, net: assets - liabilities };
}

/**
 * Month-end net worth, newest last. Today's balances are the latest month;
 * earlier months walk each account's transactions backwards.
 */
export function netWorthHistory(accounts: Account[], txns: Transaction[]) {
  const balance = new Map(accounts.map((a) => [a.id, a.balance]));
  const byMonth = new Map<string, Map<string, number>>();
  for (const t of txns) {
    if (!balance.has(t.accountId)) continue;
    const month = t.date.slice(0, 7);
    const bucket = byMonth.get(month) ?? new Map<string, number>();
    bucket.set(t.accountId, (bucket.get(t.accountId) ?? 0) + t.amount);
    byMonth.set(month, bucket);
  }
  const points: { month: string; assets: number; liabilities: number; net: number }[] = [];
  for (const month of [...byMonth.keys()].sort().reverse()) {
    points.push({ month, ...netWorth(accounts.map((a) => ({ ...a, balance: balance.get(a.id) ?? 0 }))) });
    for (const [id, amount] of byMonth.get(month)!) balance.set(id, (balance.get(id) ?? 0) - amount);
  }
  return points.reverse();
}

/** What you own today, by account type. Loans and cards are left out. Shares sum to 100. */
export function assetAllocation(accounts: Account[]) {
  const groups = new Map<string, number>();
  let assets = 0;
  for (const a of accounts) {
    if (LIABILITY.has(a.type) || a.balance <= 0) continue;
    assets += a.balance;
    groups.set(a.type, (groups.get(a.type) ?? 0) + a.balance);
  }
  return [...groups.entries()]
    .map(([type, amount]) => ({ type, amount, pct: assets ? (amount / assets) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

export function months(txns: Transaction[]): string[] {
  return [...new Set(txns.map((t) => t.date.slice(0, 7)))].sort();
}

/** CAS rows live on the fund account (units/NAV tags); they are holdings movements, not cash flow. */
const isFundLedger = (t: Transaction) => !!t.tags?.some((x) => x.startsWith("units:"));

const isSpend = (t: Transaction) => t.amount < 0 && !["investments", "transfers"].includes(t.category);

export function spendByCategory(txns: Transaction[], month?: string) {
  const map = new Map<Category, number>();
  for (const t of txns) {
    if (!isSpend(t) || (month && !t.date.startsWith(month))) continue;
    map.set(t.category, (map.get(t.category) ?? 0) + -t.amount);
  }
  return [...map.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

export function monthlyCashflow(txns: Transaction[]) {
  return months(txns).map((m) => {
    let income = 0, spend = 0, invested = 0;
    for (const t of txns) {
      if (!t.date.startsWith(m)) continue;
      if (t.category === "transfers" || isFundLedger(t)) continue;
      if (t.amount > 0) income += t.amount;
      else if (t.category === "investments") invested += -t.amount;
      else if (isSpend(t)) spend += -t.amount;
    }
    return { month: m, income, spend, invested, saved: income - spend - invested };
  }).filter((f) => f.income || f.spend || f.invested);
}

export function topMerchants(txns: Transaction[], month?: string, n = 5) {
  const map = new Map<string, { amount: number; count: number; category: Category }>();
  for (const t of txns) {
    if (!isSpend(t) || (month && !t.date.startsWith(month))) continue;
    const k = t.merchant ?? t.description;
    const cur = map.get(k) ?? { amount: 0, count: 0, category: t.category };
    cur.amount += -t.amount; cur.count += 1;
    map.set(k, cur);
  }
  return [...map.entries()].map(([merchant, v]) => ({ merchant, ...v })).sort((a, b) => b.amount - a.amount).slice(0, n);
}

export function dailySpend(txns: Transaction[], month: string) {
  const days = new Map<number, number>();
  for (const t of txns) if (isSpend(t) && t.date.startsWith(month)) {
    const d = Number(t.date.slice(8, 10));
    days.set(d, (days.get(d) ?? 0) + -t.amount);
  }
  let cum = 0;
  const last = Math.max(0, ...days.keys());
  return Array.from({ length: last }, (_, i) => { cum += days.get(i + 1) ?? 0; return { day: i + 1, cumulative: cum }; });
}

export function budgetProgress(budgets: Budget[], txns: Transaction[], month: string) {
  const spend = new Map(spendByCategory(txns, month).map((s) => [s.category, s.amount]));
  return budgets.filter((b) => b.month === month).map((b) => {
    const spent = spend.get(b.category) ?? 0;
    return { ...b, spent, pct: b.limit ? (spent / b.limit) * 100 : 0, left: b.limit - spent };
  });
}

/** Month-by-month amortisation; optional extra monthly prepayment. */
export function amortise(d: Debt, extra = 0, maxMonths = 600) {
  const r = d.annualRatePct / 100 / 12;
  let bal = d.outstanding;
  let interest = 0;
  const points: { month: number; balance: number }[] = [{ month: 0, balance: bal }];
  let m = 0;
  while (bal > 0 && m < maxMonths) {
    const int = Math.round(bal * r);
    const pay = Math.min(bal + int, d.emi + extra);
    if (pay <= int) break; // EMI doesn't cover interest
    interest += int;
    bal = bal + int - pay;
    m += 1;
    points.push({ month: m, balance: Math.max(0, bal) });
  }
  return { months: m, interest, points };
}

export function creditCards(accounts: Account[]) {
  return accounts.filter((a) => a.type === "credit_card").map((c) => {
    const owed = Math.abs(Math.min(c.balance, 0));
    const limit = c.creditLimit ?? 0;
    return { ...c, owed, limit, utilisation: limit ? (owed / limit) * 100 : 0, available: Math.max(0, limit - owed) };
  });
}

/** Future value of a monthly SIP at an assumed annual return (illustrative only). */
export function sipProjection(s: Sip, years: number, annualReturnPct: number) {
  const r = annualReturnPct / 100 / 12;
  const out: { year: number; invested: number; value: number }[] = [];
  let value = 0, invested = 0, amt = s.amount;
  for (let mth = 1; mth <= years * 12; mth++) {
    value = value * (1 + r) + amt;
    invested += amt;
    if (mth % 12 === 0) {
      out.push({ year: mth / 12, invested, value: Math.round(value) });
      amt = Math.round(amt * (1 + (s.stepUpPctYearly ?? 0) / 100));
    }
  }
  return out;
}

/** Reconstruct a daily balance history for an account by walking transactions backwards. */
export function balanceHistory(account: Account, txns: Transaction[]) {
  const own = txns.filter((t) => t.accountId === account.id).sort((a, b) => a.date.localeCompare(b.date));
  const byDay = new Map<string, number>();
  for (const t of own) byDay.set(t.date, (byDay.get(t.date) ?? 0) + t.amount);
  const days = [...byDay.keys()].sort();
  let bal = account.balance;
  const pts: { date: string; balance: number }[] = [];
  for (let i = days.length - 1; i >= 0; i--) {
    pts.push({ date: days[i], balance: bal });
    bal -= byDay.get(days[i]) ?? 0;
  }
  return pts.reverse();
}

/** Latest month with a meaningful number of transactions (skip a just-started month). */
export function defaultMonth(txns: Transaction[], min = 15): string {
  const ms = months(txns);
  for (let i = ms.length - 1; i >= 0; i--) if (txns.filter((t) => t.date.startsWith(ms[i])).length >= min) return ms[i];
  return ms[ms.length - 1];
}

/**
 * A monthly budget repeats until it is changed: use the month's own lines, else the latest earlier plan,
 * else the earliest later plan (e.g. a plan saved in October shown against September's data).
 */
export function planFor(budgets: Budget[], month: string): Budget[] {
  const own = budgets.filter((b) => b.month === month);
  if (own.length) return own;
  const ms = [...new Set(budgets.map((b) => b.month))].sort();
  const src = [...ms].reverse().find((m) => m < month) ?? ms.find((m) => m > month);
  return src ? budgets.filter((b) => b.month === src).map((b) => ({ ...b, month })) : [];
}
