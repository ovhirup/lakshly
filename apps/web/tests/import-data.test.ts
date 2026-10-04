import { describe, expect, it } from "vitest";
import { emptyDataset, mergeResult, textDocFromLines, parseDocument } from "@lakshly/parsers";
import { mergeImportDetails } from "../lib/import/merge";
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

describe("saved CAS holding snapshots", () => {
  const result = () => parseDocument(textDocFromLines([
    "NSDL Consolidated Account Statement", "01-Aug-2026 To 31-Aug-2026", "Demat Account",
    "Mutual Fund Units held with RTAs (MF Folios)",
    "Demo Fund INF000K01AB2 70001234 / 12 125.125 80.22 9000.00 10037.53 -",
  ]));
  it("collapses saved legacy and canonical holdings and remaps all statement history", () => {
    const parsed = result(), [legacy] = Object.keys(parsed.accountAliases!), canonical = parsed.accounts[0].id;
    const base = { holdings: [{ ...parsed.holdings[0], accountId: legacy, navDate: "2026-10-01", marketValue: 2000000 }, parsed.holdings[0]], statements: [{ ...parsed.meta[0], accountId: legacy }] };
    const dataset = { ...emptyDataset(), accounts: [{ ...parsed.accounts[0], asOf: "2026-10-01", balance: 2000000 }] };
    const before = JSON.stringify({ base, parsed });
    const details = mergeImportDetails(base, parsed, dataset, parsed.accountAliases!);
    expect(details.holdings).toEqual([{ ...base.holdings[0], accountId: canonical }]);
    expect(details.statements).toEqual([base.statements[0], parsed.meta[0]].map((x) => ({ ...x, accountId: canonical })));
    expect(JSON.stringify({ base, parsed })).toBe(before);
  });
  it("retains the canonical group on equal dates and ignores a snapshot older than the saved account", () => {
    const parsed = result(), [legacy] = Object.keys(parsed.accountAliases!);
    const canonical = { ...parsed.holdings[0], navDate: "2026-10-01", marketValue: 3000000 };
    const old = { ...canonical, accountId: legacy, marketValue: 2000000 };
    const dataset = { ...emptyDataset(), accounts: [{ ...parsed.accounts[0], asOf: "2026-10-01" }] };
    for (const holdings of [[old, canonical], [canonical, old]]) {
      expect(mergeImportDetails({ holdings, statements: [] }, parsed, dataset, parsed.accountAliases!).holdings).toEqual([canonical]);
    }
  });
  it("replaces the whole MF snapshot on an equally dated incoming valuation", () => {
    const parsed = result();
    const merged = mergeResult(emptyDataset(), parsed);
    expect(mergeImportDetails({ holdings: [{ ...parsed.holdings[0], units: 1 }], statements: [] }, parsed, merged.dataset, merged.accountAliases).holdings).toEqual(parsed.holdings);
  });
  it("preserves every security in a demat account and other untouched accounts", () => {
    const parsed = result(), dataset = mergeResult(emptyDataset(), parsed).dataset;
    const stocks = ["INE000A01011", "INE000B01012"].map((isin) => ({ ...parsed.holdings[0], accountId: "acc_stocks", isin }));
    const details = mergeImportDetails({ holdings: stocks, statements: [] }, parsed, dataset, parsed.accountAliases!);
    expect(details.holdings).toEqual([...stocks, ...parsed.holdings]);
  });
});
