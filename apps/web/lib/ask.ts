// On-device answers from the books already loaded. No model, no network.
import type { Account, Debt, Transaction } from "./schema.gen";
import { formatINR, formatMonth, formatPct, titleCase } from "./format";
import { defaultMonth, monthlyCashflow, netWorth, spendByCategory, topMerchants } from "./selectors";

/** Free 10 / Premium 100 questions a month, from the public plan. Not a shared catalog change. */
export const ASK_LIMIT = { free: 10, premium: 100 } as const;

export type AskPlan = keyof typeof ASK_LIMIT;

export interface AskBooks {
  accounts: Account[];
  transactions: Transaction[];
  debts: Debt[];
}

export interface AskReply {
  text: string;
  /** True when the sentence is Lakshly's own arithmetic. */
  calc: boolean;
}

const HELP = "Ask about net worth, this month's spend, savings, the top category, or debt. I answer from the numbers already on this device. Nothing is sent.";

function clean(question: string): string {
  return question.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function monthLine(books: AskBooks) {
  const month = defaultMonth(books.transactions);
  const flow = monthlyCashflow(books.transactions).find((row) => row.month === month);
  return { month, flow };
}

export function answerQuestion(question: string, books: AskBooks): AskReply {
  const q = clean(question);
  if (!q || /\b(help|what can you)\b/.test(q)) return { text: HELP, calc: false };

  if (/\b(net worth|assets|liabilities)\b/.test(q) || /\bworth\b/.test(q)) {
    const nw = netWorth(books.accounts);
    return {
      calc: true,
      text: `Net worth is ${formatINR(nw.net)} (${formatINR(nw.assets)} in assets, ${formatINR(nw.liabilities)} owed). my calc`,
    };
  }

  if (/\b(categor|where did|most)\b/.test(q)) {
    const { month } = monthLine(books);
    const cats = spendByCategory(books.transactions, month);
    if (!cats.length) return { text: `I don't see spend in ${formatMonth(month)}.`, calc: false };
    const total = cats.reduce((sum, row) => sum + row.amount, 0);
    const top = cats[0];
    const share = total ? (top.amount / total) * 100 : 0;
    return {
      calc: true,
      text: `In ${formatMonth(month)} the largest category was ${titleCase(top.category)} at ${formatINR(top.amount)}, ${formatPct(share, 0)} of that month's spend. my calc`,
    };
  }

  if (/\b(merchant|shop)\b/.test(q)) {
    const { month } = monthLine(books);
    const top = topMerchants(books.transactions, month, 1)[0];
    if (!top) return { text: `I don't see a merchant in ${formatMonth(month)}.`, calc: false };
    return { calc: true, text: `In ${formatMonth(month)} the largest merchant was ${top.merchant} at ${formatINR(top.amount)}. my calc` };
  }

  if (/\b(save|saved|saving)\b/.test(q)) {
    const { month, flow } = monthLine(books);
    if (!flow) return { text: `I don't see cash flow in ${formatMonth(month)}.`, calc: false };
    const rate = flow.income ? (flow.saved / flow.income) * 100 : 0;
    return { calc: true, text: `In ${formatMonth(month)} you saved ${formatINR(flow.saved)}, a ${formatPct(rate, 0)} savings rate. my calc` };
  }

  if (/\b(income|earn|salary)\b/.test(q)) {
    const { month, flow } = monthLine(books);
    if (!flow) return { text: `I don't see income in ${formatMonth(month)}.`, calc: false };
    return { calc: true, text: `In ${formatMonth(month)} income was ${formatINR(flow.income)}. my calc` };
  }

  if (/\b(debt|loan|owe|emi|outstanding)\b/.test(q)) {
    if (!books.debts.length) return { text: "No debts in this data.", calc: false };
    const outstanding = books.debts.reduce((sum, debt) => sum + debt.outstanding, 0);
    const top = [...books.debts].sort((a, b) => b.outstanding - a.outstanding)[0];
    return {
      calc: true,
      text: `Outstanding debt is ${formatINR(outstanding)}. The largest is ${top.name} at ${formatINR(top.outstanding)}. my calc`,
    };
  }

  if (/\b(spend|spent|expense)\b/.test(q)) {
    const { month, flow } = monthLine(books);
    if (!flow) return { text: `I don't see spend in ${formatMonth(month)}.`, calc: false };
    return { calc: true, text: `In ${formatMonth(month)} you spent ${formatINR(flow.spend)}. my calc` };
  }

  return { text: HELP, calc: false };
}

export function readAskCounts(raw: string | null): Record<string, number> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (/^\d{4}-\d{2}$/.test(key) && typeof value === "number" && Number.isFinite(value) && value >= 0) out[key] = Math.floor(value);
    }
    return out;
  } catch {
    return {};
  }
}

/** Counts one question when the month is still under the cap. */
export function takeAsk(counts: Readonly<Record<string, number>>, month: string, cap: number): { counts: Record<string, number>; allowed: boolean } {
  const used = counts[month] ?? 0;
  if (used >= cap) return { counts: { ...counts }, allowed: false };
  return { counts: { ...counts, [month]: used + 1 }, allowed: true };
}
