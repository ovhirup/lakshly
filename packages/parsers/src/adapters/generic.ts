import type { Adapter, TextDoc } from "../types.ts";
import { docText, findText } from "../table.ts";
import { parseBank, parseCard } from "../engines.ts";

const CARD_SIGNALS = [/Min(imum)?\.? (Amount )?Due/i, /Total (Amount )?Due|Total Dues|Total Outstanding/i, /(Payment )?Due Date/i, /Credit Limit|Card (No|Number)/i];

function institutionGuess(doc: TextDoc, fallback: string): string {
  const m = findText(doc, /\b([A-Z][A-Za-z&]+(?: [A-Z][A-Za-z&]+){0,3} (?:Bank|Card|Cards))\b/);
  return m ? m[1].slice(0, 60) : fallback;
}

/** Generic table heuristic: header keywords + column positions, sign from Dr/Cr columns or balance movement. */
export const genericBank: Adapter = {
  id: "bank.generic",
  label: "Bank statement (generic layout)",
  kind: "bank",
  institution: "Bank",
  detect: (doc) => {
    const t = docText(doc);
    const cardish = CARD_SIGNALS.filter((r) => r.test(t)).length;
    const hits = [/\b(Date|Txn Date|Tran Date)\b/i, /(Narration|Description|Particulars|Remarks|Details)/i, /(Withdrawal|Debit|Dr\b)/i, /(Deposit|Credit|Cr\b)/i, /Balance/i].filter((r) => r.test(t)).length;
    return cardish >= 2 ? 0.1 : 0.15 + 0.06 * hits;
  },
  parse: (doc) => parseBank(doc, {
    adapter: "bank.generic",
    institution: institutionGuess(doc, "Bank"),
    spec: {
      date: /^(Date|Txn\.? Date|Tran(saction)? Date|Posting Date)$/i,
      valueDate: /^Value (Date|Dt)$/i,
      narration: /^(Narration|Description|Particulars|Remarks|Transaction (Details|Remarks|Description)|Details)$/i,
      ref: /^(Chq|Cheque|Ref)/i,
      debit: /^(Withdrawals?( Amt\.?| Amount.*)?|Debits?( Amount.*)?|Dr\.?)$/i,
      credit: /^(Deposits?( Amt\.?| Amount.*)?|Credits?( Amount.*)?|Cr\.?)$/i,
      amount: /^Amount( \(.*\))?$/i,
      balance: /^(Closing )?Balance( \(.*\))?$/i,
    },
    minHits: 3,
  }),
};

export const genericCard: Adapter = {
  id: "card.generic",
  label: "Credit card statement (generic layout)",
  kind: "card",
  institution: "Card",
  detect: (doc) => {
    const hits = CARD_SIGNALS.filter((r) => r.test(docText(doc))).length;
    return hits >= 2 ? 0.2 + 0.07 * hits : 0;
  },
  parse: (doc) => parseCard(doc, {
    adapter: "card.generic",
    institution: institutionGuess(doc, "Credit Card"),
    labels: { totalDue: /Total (Amount )?Due|Total Dues|Total Outstanding/i, minDue: /Min(imum)?\.? (Amount )?Due/i, dueDate: /(Payment )?Due Date/i, statementDate: /Statement Date|Bill Date/i, limit: /Credit Limit/i },
  }),
};
