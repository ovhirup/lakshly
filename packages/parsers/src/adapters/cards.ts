import type { Adapter } from "../types.ts";
import { parseCard } from "../engines.ts";
import { score } from "./banks.ts";

/**
 * HDFC Bank credit card statement: summary box with "Payment Due Date | Total Dues | Minimum Amount Due"
 * (labels above values), transactions "dd/mm/yyyy  Description  Amount" with "Cr" for credits.
 */
export const hdfcCard: Adapter = {
  id: "card.hdfc",
  label: "HDFC Bank credit card statement",
  kind: "card",
  institution: "HDFC Bank",
  detect: (doc) => score(doc, /HDFC BANK/i, [/Credit Card/i, /Total Dues/i, /Minimum Amount Due/i, /Payment Due Date/i, /Domestic Transactions/i]),
  parse: (doc) => parseCard(doc, {
    adapter: "card.hdfc",
    institution: "HDFC Bank",
    labels: { totalDue: /^Total Dues$/i, minDue: /^Minimum Amount Due$/i, dueDate: /^Payment Due Date$/i, statementDate: /^Statement Date$/i, limit: /^Credit Limit$/i },
    startRe: /Domestic Transactions|International Transactions/i,
    endRe: /Reward Points Summary|Important Information/i,
  }),
};

/**
 * SBI Card statement: "Total Amount Due : ₹ x", "Minimum Amount Due : ₹ x", "Payment Due Date : dd Mon yyyy",
 * transactions "dd Mon yy  Description  Amount D|C".
 */
export const sbiCard: Adapter = {
  id: "card.sbi",
  label: "SBI Card statement",
  kind: "card",
  institution: "SBI Card",
  detect: (doc) => score(doc, /SBI Card/i, [/Total Amount Due/i, /Minimum Amount Due/i, /Payment Due Date/i, /Transactions for/i, /Statement Date/i]),
  parse: (doc) => parseCard(doc, {
    adapter: "card.sbi",
    institution: "SBI Card",
    labels: { totalDue: /Total Amount Due/i, minDue: /Minimum Amount Due/i, dueDate: /Payment Due Date/i, statementDate: /Statement Date/i, limit: /Credit Limit/i },
    startRe: /Transactions for/i,
    endRe: /Reward Summary|Important Messages/i,
  }),
};
