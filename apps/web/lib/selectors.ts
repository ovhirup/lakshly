import type { Account, Budget, Category, Debt, Sip, Transaction } from "./schema.gen";

export const CATEGORY_COLORS: Record<string, string> = {
  groceries: "var(--lk-income)", dining: "var(--lk-gold-text)", transport: "var(--lk-blue)", fuel: "var(--lk-spend)", shopping: "var(--lk-lotus)",
  utilities: "var(--lk-indigo)", rent: "var(--lk-danger)", health: "var(--lk-invest)", entertainment: "var(--lk-gold-text)", subscriptions: "var(--lk-indigo)",
  travel: "var(--lk-blue)", insurance: "var(--lk-text-muted)", investments: "var(--lk-invest)", emi: "var(--lk-spend)", income: "var(--lk-income)", other: "var(--lk-text-muted)",
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

export function months(txns: Transaction[]): string[] {
  return [...new Set(txns.map((t) => t.date.slice(0, 7)))].sort();
}

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
      if (t.category === "transfers") continue;
      if (t.amount > 0) income += t.amount;
      else if (t.category === "investments") invested += -t.amount;
      else if (isSpend(t)) spend += -t.amount;
    }
    return { month: m, income, spend, invested, saved: income - spend - invested };
  });
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
