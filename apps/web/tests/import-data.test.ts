import { describe, expect, it } from "vitest";
import { emptyDataset, mergeResult, textDocFromLines, parseDocument } from "@lakshly/parsers";
import { monthlyCashflow } from "../lib/selectors";

describe("imported data in the web selectors", () => {
  it("treats CAS fund-ledger rows as holdings, not income, and drops empty months", () => {
    const cas = parseDocument(textDocFromLines([
      "Consolidated Account Statement",
      "01-Apr-2026 To 30-Sep-2026",
      "Example Demo Mutual Fund",
      "Folio No: 91234567 / 12   PAN: OK",
      "D123-Example Demo Flexi Cap Fund - Direct Plan - Growth (Advisor: DIRECT)   ISIN: INF0DEMO0001   Registrar : CAMS",
      "Opening Unit Balance: 0.000",
      "05-Apr-2026   Systematic Investment Purchase - Instalment 1   5,000.00   45.122   110.8100   45.122",
      "Closing Unit Balance: 45.122   NAV on 30-Sep-2026: INR 121.3400   Total Cost Value: 5,000.00   Market Value on 30-Sep-2026: INR 5,475.10",
    ]));
    expect(cas.adapter).toBe("cas.cams-kfintech");
    const { dataset } = mergeResult(emptyDataset(), cas);
    expect(dataset.transactions).toHaveLength(1);
    expect(monthlyCashflow(dataset.transactions)).toEqual([]);
  });
});
