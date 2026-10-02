import type { Adapter, TextDoc } from "../types.ts";
import { docText } from "../table.ts";
import { parseBank } from "../engines.ts";

/** Score helper: fraction of signals present, gated by a required brand signal. */
export function score(doc: TextDoc, brand: RegExp, signals: RegExp[]): number {
  const text = docText(doc);
  if (!brand.test(text)) return 0;
  const hits = signals.filter((re) => re.test(text)).length;
  return 0.4 + 0.6 * (hits / signals.length);
}

/**
 * HDFC Bank savings/current account statement (publicly documented layout):
 * Date | Narration | Chq./Ref.No. | Value Dt | Withdrawal Amt. | Deposit Amt. | Closing Balance, dates dd/mm/yy.
 */
export const hdfcBank: Adapter = {
  id: "bank.hdfc",
  label: "HDFC Bank account statement",
  kind: "bank",
  institution: "HDFC Bank",
  detect: (doc) => score(doc, /HDFC BANK/i, [/Withdrawal Amt/i, /Deposit Amt/i, /Closing Balance/i, /Chq\.?\s*\/\s*Ref/i, /Value Dt/i, /Narration/i]),
  parse: (doc) => parseBank(doc, {
    adapter: "bank.hdfc",
    institution: "HDFC Bank",
    spec: { date: /^Date$/i, narration: /^Narration$/i, ref: /^Chq\.?\s*\/?\s*Ref\.?\s*No\.?$/i, valueDate: /^Value Dt$/i, debit: /^Withdrawal Amt\.?$/i, credit: /^Deposit Amt\.?$/i, balance: /^Closing Balance$/i },
    minHits: 5,
  }),
};

/**
 * State Bank of India account statement (YONO / online export):
 * Txn Date | Value Date | Description | Ref No./Cheque No. | Debit | Credit | Balance, dates "1 Sep 2026".
 */
export const sbiBank: Adapter = {
  id: "bank.sbi",
  label: "SBI account statement",
  kind: "bank",
  institution: "State Bank of India",
  detect: (doc) => score(doc, /State Bank of India|\bSBI\b/i, [/Txn Date/i, /Ref No\.?\s*\/?\s*Cheque/i, /\bDebit\b/i, /\bCredit\b/i, /\bBalance\b/i, /IFS(C)? Code/i]) * (/SBI Card/i.test(docText(doc)) ? 0 : 1),
  parse: (doc) => parseBank(doc, {
    adapter: "bank.sbi",
    institution: "State Bank of India",
    spec: { date: /^Txn Date$/i, valueDate: /^Value Date$/i, narration: /^Description$/i, ref: /^Ref No\.?\s*\/?\s*Cheque No\.?$/i, debit: /^Debit$/i, credit: /^Credit$/i, balance: /^Balance$/i },
    minHits: 5,
  }),
};

/**
 * ICICI Bank account statement (detailed statement):
 * S No. | Value Date | Transaction Date | Cheque Number | Transaction Remarks | Withdrawal Amount (INR ) | Deposit Amount (INR ) | Balance (INR ).
 */
export const iciciBank: Adapter = {
  id: "bank.icici",
  label: "ICICI Bank account statement",
  kind: "bank",
  institution: "ICICI Bank",
  detect: (doc) => score(doc, /ICICI Bank/i, [/Transaction Remarks/i, /Withdrawal Amount/i, /Deposit Amount/i, /Balance \(INR/i, /Cheque Number/i, /S\s?No\.?/i]) * (/Minimum Amount Due/i.test(docText(doc)) ? 0.3 : 1),
  parse: (doc) => parseBank(doc, {
    adapter: "bank.icici",
    institution: "ICICI Bank",
    spec: { serial: /^S\s?No\.?$/i, valueDate: /^Value Date$/i, date: /^Transaction Date$/i, ref: /^Cheque Number$/i, narration: /^Transaction Remarks$/i, debit: /^Withdrawal Amount/i, credit: /^Deposit Amount/i, balance: /^Balance/i },
    minHits: 5,
  }),
};
