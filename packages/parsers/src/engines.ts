import type { Account, ParseResult, StatementMeta, TextDoc, Transaction } from "./types.ts";
import { categorise, detectMethod, guessMerchant } from "./categorise.ts";
import { parseDate } from "./util/dates.ts";
import { stableId } from "./util/hash.ts";
import { last4, redactNumbers } from "./util/mask.ts";
import { parseAmount } from "./util/money.ts";
import { findText, readTable, signedAmounts, valueNear, type HeaderSpec, type Row } from "./table.ts";

type Body = Omit<ParseResult, "adapter" | "adapterLabel" | "kind" | "confidence">;

const DATE_TOKEN = String.raw`(\d{1,2}[/.\- ](?:\d{1,2}|[A-Za-z]{3,4})[/.\- ]\d{2,4})`;

export function findAccountMask(doc: TextDoc, re = /(?:A\/C|Account|Acct)\s*(?:No|Number|#)?\.?\s*[:\-]?\s*([0-9Xx*][0-9Xx*\s-]{5,24}\d)/i): string | undefined {
  const m = findText(doc, re);
  return m ? last4(m[1]) : undefined;
}

export function findPeriod(doc: TextDoc): { from?: string; to?: string } {
  const m = findText(doc, new RegExp(String.raw`(?:from|period|statement period)\s*:?\s*${DATE_TOKEN}\s*(?:to|-|–)\s*:?\s*${DATE_TOKEN}`, "i"));
  if (!m) return {};
  return { from: parseDate(m[1].replace(/ /g, "-")) ?? undefined, to: parseDate(m[2].replace(/ /g, "-")) ?? undefined };
}

export function normDesc(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}

/** Turn signed rows into schema transactions with stable ids (occurrence-indexed for exact repeats). */
export function toTransactions(accountId: string, items: { date: string; amount: number; narration: string }[], method: Transaction["method"] | null): Transaction[] {
  const seen = new Map<string, number>();
  return items.map(({ date, amount, narration }) => {
    const description = redactNumbers(narration.replace(/\s+/g, " ").trim()).slice(0, 140) || "Transaction";
    const key = `${date}|${amount}|${normDesc(description)}`;
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    const merchant = guessMerchant(description);
    const t: Transaction = {
      id: stableId("txn", accountId, key, n),
      accountId,
      date,
      amount,
      description,
      category: categorise(description, amount),
      method: method ?? detectMethod(description, "other"),
      categorisedBy: "rule",
    };
    if (merchant) t.merchant = merchant;
    return t;
  });
}

export interface BankOpts {
  adapter: string;
  institution: string;
  spec: HeaderSpec;
  minHits?: number;
  accountRe?: RegExp;
}

export function parseBank(doc: TextDoc, o: BankOpts): Body {
  const warnings: string[] = [];
  const rows: Row[] = readTable(doc, o.spec, { minHits: o.minHits });
  const opening = valueNear(doc, /Opening Balance/i, "amount") as number | undefined;
  const signed = signedAmounts(rows, opening);
  if (!signed.length) warnings.push("No transactions found. Is this a savings/current account statement?");
  const mask = findAccountMask(doc, o.accountRe);
  if (!mask) warnings.push("Account number not found; account will be matched by bank name only.");
  const period = findPeriod(doc);
  const accountId = stableId("acc", o.institution, "savings", mask ?? "");
  const lastBal = [...rows].reverse().find((r) => r.balance !== undefined)?.balance;
  const closing = lastBal ?? (valueNear(doc, /Closing Bal(ance)?/i, "amount") as number | undefined) ?? 0;
  const asOf = period.to ?? signed.at(-1)?.row.date ?? new Date().toISOString().slice(0, 10);
  const account: Account = {
    id: accountId,
    name: `${o.institution} Savings${mask ? ` ••${mask}` : ""}`.slice(0, 80),
    type: "savings",
    institution: o.institution,
    currency: "INR",
    balance: closing,
    asOf,
    source: "statement",
  };
  if (mask) account.mask = mask;
  // Sanity check: opening + sum(amounts) should equal the closing balance.
  if (opening !== undefined && closing) {
    const sum = signed.reduce((s, x) => s + x.amount, 0);
    if (Math.abs(opening + sum - closing) > 100) warnings.push("Totals don't reconcile with the closing balance; please review amounts.");
  }
  const transactions = toTransactions(accountId, signed.map((s) => ({ date: s.row.date, amount: s.amount, narration: s.row.narration })), null);
  // No printed opening balance (typical CSV export): derive it from the first row's running balance.
  const first = signed[0];
  const openingBalance = opening ?? (first && first.row.balance !== undefined ? first.row.balance - first.amount : undefined);
  const meta: StatementMeta = { adapter: o.adapter, kind: "bank", institution: o.institution, accountId, periodFrom: period.from ?? signed[0]?.row.date, periodTo: period.to ?? signed.at(-1)?.row.date, openingBalance, closingBalance: closing };
  return { accounts: [account], transactions, sips: [], holdings: [], meta: [meta], warnings };
}

export interface CardOpts {
  adapter: string;
  institution: string;
  labels: { totalDue: RegExp; minDue: RegExp; dueDate: RegExp; statementDate: RegExp; limit?: RegExp };
  /** Where the transaction table starts / ends (optional). */
  startRe?: RegExp;
  endRe?: RegExp;
  cardRe?: RegExp;
}

const CARD_ROW = /^(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{1,2}[\s-][A-Za-z]{3,4}[\s-]\d{2,4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?\s+(.+?)\s+((?:₹\s?)?\d{1,3}(?:,\d{2,3})*\.\d{2}|\d+\.\d{2})\s*(Cr|CR|C|Dr|DR|D)?$/;

export function parseCard(doc: TextDoc, o: CardOpts): Body {
  const warnings: string[] = [];
  const totalDue = valueNear(doc, o.labels.totalDue, "amount") as number | undefined;
  const minDue = valueNear(doc, o.labels.minDue, "amount") as number | undefined;
  const dueDate = valueNear(doc, o.labels.dueDate, "date") as string | undefined;
  const statementDate = valueNear(doc, o.labels.statementDate, "date") as string | undefined;
  const limit = o.labels.limit ? (valueNear(doc, o.labels.limit, "amount") as number | undefined) : undefined;
  const cm = findText(doc, o.cardRe ?? /(?:Card\s*(?:No|Number)\.?\s*[:\-]?\s*)([0-9Xx*][0-9Xx*\s-]{10,22}\d)/i)
    ?? findText(doc, /\b((?:[0-9Xx*]{4}[\s-]?){3}\d{4})\b/);
  const mask = cm ? last4(cm[1]) : undefined;

  const items: { date: string; amount: number; narration: string }[] = [];
  let inTable = !o.startRe;
  for (const line of doc.lines) {
    const text = line.text.replace(/\s{2,}/g, "  ").trim();
    if (o.startRe && o.startRe.test(text)) { inTable = true; continue; }
    if (o.endRe && o.endRe.test(text)) { inTable = false; continue; }
    if (!inTable) continue;
    const m = text.replace(/\s+/g, " ").match(CARD_ROW);
    if (!m) continue;
    const date = parseDate(m[1]);
    const amt = parseAmount(m[3]);
    if (!date || amt === null) continue;
    const credit = !!m[4] && /^c/i.test(m[4]);
    items.push({ date, amount: credit ? Math.abs(amt) : -Math.abs(amt), narration: m[2] });
  }
  if (!items.length) warnings.push("No card transactions found.");
  if (totalDue === undefined) warnings.push("Total amount due not found.");
  const accountId = stableId("acc", o.institution, "credit_card", mask ?? "");
  const transactions = toTransactions(accountId, items, "card").map((t) =>
    t.amount > 0 && t.category === "income" ? { ...t, category: /PAYMENT|THANK/i.test(t.description) ? "transfers" as const : "other" as const } : t);
  const account: Account = {
    id: accountId,
    name: `${o.institution} Credit Card${mask ? ` ••${mask}` : ""}`.slice(0, 80),
    type: "credit_card",
    institution: o.institution,
    currency: "INR",
    balance: -(totalDue ?? -transactions.reduce((s, t) => s + t.amount, 0)),
    asOf: statementDate ?? items.at(-1)?.date ?? new Date().toISOString().slice(0, 10),
    source: "statement",
  };
  if (mask) account.mask = mask;
  if (limit) account.creditLimit = limit;
  if (statementDate) account.statementDay = Number(statementDate.slice(8, 10));
  if (dueDate) account.dueDay = Number(dueDate.slice(8, 10));
  const meta: StatementMeta = { adapter: o.adapter, kind: "card", institution: o.institution, accountId, statementDate, dueDate, totalDue, minDue };
  return { accounts: [account], transactions, sips: [], holdings: [], meta: [meta], warnings };
}
