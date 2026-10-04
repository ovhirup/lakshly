// Refunds owed to you, and family loans you owe. Pure helpers: no storage, no network.
import type { Debt, Transaction } from "./schema.gen";

/**
 * Short summary of RBI's 20 September 2019 circular
 * RBI/2019-20/67 (DPSS.CO.PD No.629/02.01.014/2019-20),
 * "Harmonisation of Turn Around Time (TAT) and customer compensation
 * for failed transactions using authorised Payment Systems".
 * T+n is calendar days after the failed payment. Not legal advice.
 */
export const TAT_SOURCE = "RBI/2019-20/67, 20 September 2019";

export const TAT = [
  { id: "atm", label: "ATM", days: 5, detail: "Failed ATM withdrawal, including a micro-ATM" },
  { id: "card", label: "Card", days: 5, detail: "Failed card payment at a shop or online" },
  { id: "imps", label: "IMPS", days: 1, detail: "Failed IMPS transfer" },
  { id: "upi", label: "UPI", days: 1, detail: "Failed UPI payment" },
] as const;

export type TatId = (typeof TAT)[number]["id"];

const NAMED_REFUND = /\b(refund|refunded|reversal|reversed|chargeback)\b/i;

/** Credits that name a refund. Spend-category credits are left to the weekly review. */
export function namedRefunds(txns: Transaction[]): Transaction[] {
  return txns
    .filter((t) => t.amount > 0 && ((t.tags ?? []).includes("refund") || NAMED_REFUND.test(`${t.description ?? ""} ${t.merchant ?? ""}`)))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

export function familyLoans(debts: Debt[]): Debt[] {
  return debts.filter((d) => d.kind === "family" && d.outstanding > 0);
}

export function calendarDaysAfter(fromIso: string, toIso: string): number {
  const utc = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  return Math.round((utc(toIso) - utc(fromIso)) / 86_400_000);
}

export function tatFor(id: TatId) {
  return TAT.find((row) => row.id === id) ?? TAT[0];
}

export function tatStatus(id: TatId, paidOn: string, today: string) {
  const row = tatFor(id);
  const elapsed = calendarDaysAfter(paidOn, today);
  return { ...row, elapsed, lateBy: Math.max(0, elapsed - row.days), overdue: elapsed > row.days };
}

export interface ComplaintInput {
  channel: TatId;
  merchant: string;
  amountPaise: number;
  date: string;
  reference: string;
  today: string;
}

function rupees(paise: number): string {
  const body = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Math.abs(paise) / 100);
  return paise < 0 ? `−${body}` : body;
}

/** Text the user can paste into a bank form. Lakshly does not send it. */
export function complaintText(input: ComplaintInput): string {
  const status = tatStatus(input.channel, input.date, input.today);
  const merchant = input.merchant.trim() || "the payee";
  const reference = input.reference.trim();
  return [
    `I am writing about a failed ${status.label} payment that has not been reversed.`,
    "",
    `Payee: ${merchant}`,
    `Date: ${input.date}`,
    `Amount: ${rupees(input.amountPaise)}`,
    reference ? `Reference: ${reference}` : "",
    "",
    `RBI's 20 September 2019 circular (${TAT_SOURCE}) says a failed ${status.label} payment should be reversed within ${status.days} calendar day${status.days === 1 ? "" : "s"} (T+${status.days}). ${status.elapsed} calendar day${status.elapsed === 1 ? " has" : "s have"} passed. Please reverse the amount to my account.`,
    "",
    "This note was written in Lakshly on this device. It was not sent anywhere.",
  ].filter((line) => line !== "").join("\n");
}

export type ClipboardWrite = (text: string) => Promise<void>;

export function browserClipboard(): ClipboardWrite {
  return (text) => {
    const clip = globalThis.navigator?.clipboard;
    if (!clip?.writeText) return Promise.reject(new Error("Clipboard is not available in this browser."));
    return clip.writeText(text);
  };
}

export function copyComplaint(text: string, write: ClipboardWrite = browserClipboard()): Promise<void> {
  return write(text);
}
