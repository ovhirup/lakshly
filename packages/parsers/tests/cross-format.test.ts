// QA blocker (11 Oct 2026, run-2026-10-11-launch-acceptance B6): the same bank account imported as CSV and
// as PDF must not double count. Fixtures are built in memory exactly like qa/fixtures (synthetic only):
// bank-hdfc-format.qa.csv, bank-sbi-format.qa.csv, bank-hdfc(-locked).qa.pdf (password DEMO1234), card-hdfc.qa.pdf.
import { describe, expect, it } from "vitest";
import * as F from "./fixtures/synthetic.ts";
import { extract } from "./helpers.ts";
import { emptyDataset, findDuplicateAccounts, mergeAccounts, mergeResult, parseCsv, parseDocument, sameDescription, type LakshlyDataset, type ParseResult } from "../src/index.ts";
import { detectCsvBank } from "../src/csv.ts";

const dd = (d: number) => String(d).padStart(2, "0");
const q = (s: string) => /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
function rows() { let bal = F.BANK_OPENING; return F.BANK_TXNS.map((t, i) => ({ ...t, i, bal: (bal += t.amt) })); }
const FILES: Record<string, string> = {
  "bank-hdfc-format.qa.csv": ["Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance",
    ...rows().map((r) => [`${dd(r.d)}/09/26`, r.narr.replace("\n", " "), `000000${4000 + r.i}`, `${dd(r.d)}/09/26`, r.amt < 0 ? F.inr(-r.amt) : "", r.amt > 0 ? F.inr(r.amt) : "", F.inr(r.bal)].map(q).join(","))].join("\n") + "\n",
  "bank-sbi-format.qa.csv": ["Txn Date,Value Date,Description,Ref No./Cheque No.,Debit,Credit,Balance",
    ...rows().map((r) => [`${r.d} Sep 2026`, `${r.d} Sep 2026`, r.narr.replace("\n", " "), `TRF${700000 + r.i}`, r.amt < 0 ? F.inr(-r.amt) : "", r.amt > 0 ? F.inr(r.amt) : "", F.inr(r.bal)].map(q).join(","))].join("\n") + "\n",
};
const PDFS: Record<string, () => Promise<Uint8Array> | Uint8Array> = {
  "bank-hdfc.qa.pdf": () => F.hdfcBankPdf(),
  "bank-hdfc-locked.qa.pdf": () => F.hdfcBankPdf(F.PASSWORD),
  "card-hdfc.qa.pdf": () => F.hdfcCardPdf(),
};
const readText = (f: string) => FILES[f];
const csv = (f: string) => parseCsv(readText(f), f);
const pdf = async (f: string, pw?: string) => parseDocument(await extract(new Uint8Array(await PDFS[f]()), pw), f);
const CREDITS = F.BANK_TXNS.filter((t) => t.amt > 0).reduce((s, t) => s + t.amt, 0);
const DEBITS = F.BANK_TXNS.filter((t) => t.amt < 0).reduce((s, t) => s + t.amt, 0);
const sum = (ds: LakshlyDataset, sign: 1 | -1) => ds.transactions.filter((t) => Math.sign(t.amount) === sign).reduce((s, t) => s + t.amount, 0);
const netWorth = (ds: LakshlyDataset) => ds.accounts.reduce((s, a) => s + a.balance, 0);
function run(...results: ParseResult[]) {
  let ds = emptyDataset(new Date("2026-10-11"));
  const reports = results.map((r) => { const m = mergeResult(ds, r); ds = m.dataset; return m.report; });
  return { ds, reports };
}

describe("CSV bank detection", () => {
  it("recognises HDFC and SBI CSV downloads by their header row", () => {
    expect(detectCsvBank(readText("bank-hdfc-format.qa.csv"))?.institution).toBe("HDFC Bank");
    expect(detectCsvBank(readText("bank-sbi-format.qa.csv"))?.institution).toBe("State Bank of India");
    const sbi = csv("bank-sbi-format.qa.csv");
    expect(sbi.adapter).toBe("csv.sbi");
    expect(sbi.accounts[0].institution).toBe("State Bank of India");
    expect(sbi.transactions).toHaveLength(F.BANK_TXNS.length);
    expect(detectCsvBank("Date,Description,Amount\n01/09/26,Thing,10.00")).toBeNull();
  });
  it("derives the opening balance when a CSV has only running balances", () => {
    const r = csv("bank-hdfc-format.qa.csv");
    expect(r.meta[0].openingBalance).toBe(F.BANK_OPENING);
    expect(r.meta[0].closingBalance).toBe(F.BANK_CLOSING);
  });
});

describe("same account as CSV and PDF", () => {
  it("HDFC CSV then locked HDFC PDF: one account, 12 transactions, totals not doubled", async () => {
    const { ds, reports } = run(csv("bank-hdfc-format.qa.csv"), await pdf("bank-hdfc-locked.qa.pdf", "DEMO1234"));
    expect(ds.accounts).toHaveLength(1);
    expect(ds.transactions).toHaveLength(F.BANK_TXNS.length);
    expect(reports[1]).toMatchObject({ added: 0, duplicates: F.BANK_TXNS.length, accountsAdded: 0 });
    expect(reports[1].matched?.[0].reason).toBe("institution");
    expect(sum(ds, 1)).toBe(CREDITS);
    expect(sum(ds, -1)).toBe(DEBITS);
    expect(netWorth(ds)).toBe(F.BANK_CLOSING);
    expect(ds.accounts[0]).toMatchObject({ institution: "HDFC Bank" });
    expect(ds.accounts[0].mask).toMatch(/^\d{4}$/);
  });
  it("PDF first, then CSV: same result", async () => {
    const { ds, reports } = run(await pdf("bank-hdfc.qa.pdf"), csv("bank-hdfc-format.qa.csv"));
    expect(ds.accounts).toHaveLength(1);
    expect(ds.transactions).toHaveLength(F.BANK_TXNS.length);
    expect(reports[1]).toMatchObject({ added: 0, duplicates: F.BANK_TXNS.length });
    expect(ds.accounts[0].mask).toMatch(/^\d{4}$/);
  });
  it("an old generic CSV account (no bank name) is matched by overlapping transactions", async () => {
    const generic = csv("bank-hdfc-format.qa.csv");
    const legacy: ParseResult = { ...generic, adapter: "csv.generic", accounts: generic.accounts.map((a) => ({ ...a, id: "acc_legacy", institution: "Bank", name: "Bank Savings" })), transactions: generic.transactions.map((t, i) => ({ ...t, id: `txn_legacy_${i}`, accountId: "acc_legacy" })) };
    const { ds, reports } = run(legacy, await pdf("bank-hdfc-locked.qa.pdf", "DEMO1234"));
    expect(ds.accounts).toHaveLength(1);
    expect(ds.transactions).toHaveLength(F.BANK_TXNS.length);
    expect(reports[1].matched?.[0]).toMatchObject({ reason: "overlap", baseId: "acc_legacy" });
    expect(ds.accounts[0]).toMatchObject({ id: "acc_legacy", institution: "HDFC Bank" });
  });
  it("re-importing either file again adds nothing", async () => {
    const p = await pdf("bank-hdfc.qa.pdf");
    const { ds, reports } = run(csv("bank-hdfc-format.qa.csv"), p, p, csv("bank-hdfc-format.qa.csv"));
    expect(ds.transactions).toHaveLength(F.BANK_TXNS.length);
    expect(reports.slice(1).every((r) => r.added === 0)).toBe(true);
  });
  it("a card statement with the same last 4 is not folded into the bank account", async () => {
    const { ds } = run(await pdf("bank-hdfc.qa.pdf"), await pdf("card-hdfc.qa.pdf"));
    expect(ds.accounts.map((a) => a.type).sort()).toEqual(["credit_card", "savings"]);
  });
  it("a different bank with no overlapping rows stays separate", async () => {
    const sbi = csv("bank-sbi-format.qa.csv");
    const other: ParseResult = { ...sbi, transactions: sbi.transactions.map((t) => ({ ...t, id: `${t.id}x`, date: t.date.replace("2026-09", "2026-07") })) };
    const { ds } = run(await pdf("bank-hdfc.qa.pdf"), other);
    expect(ds.accounts).toHaveLength(2);
  });
  it("two different HDFC accounts over the same dates are not merged", async () => {
    const c = csv("bank-hdfc-format.qa.csv");
    const otherAcct: ParseResult = { ...c, transactions: c.transactions.map((t, i) => ({ ...t, id: `${t.id}o`, amount: t.amount + 100 * (i + 1) })) };
    const { ds } = run(await pdf("bank-hdfc.qa.pdf"), otherAcct);
    expect(ds.accounts).toHaveLength(2);
  });
  it("two candidate accounts: not guessed, reported as ambiguous for a merge offer", () => {
    const base = csv("bank-hdfc-format.qa.csv");
    const twin = (id: string): ParseResult => ({ ...base, accounts: base.accounts.map((a) => ({ ...a, id, institution: "Bank", name: "Bank Savings" })), transactions: base.transactions.map((t) => ({ ...t, id: `${t.id}${id}`, accountId: id })) });
    let ds = emptyDataset();
    // Two saved copies (pre-fix data); a third, generic copy matches both equally.
    ds = { ...ds, accounts: [...twin("acc_a").accounts, ...twin("acc_b").accounts], transactions: [...twin("acc_a").transactions, ...twin("acc_b").transactions] };
    const { report } = mergeResult(ds, twin("acc_c"));
    expect(report.ambiguous?.[0]).toMatchObject({ incomingId: "acc_c", candidateIds: ["acc_a", "acc_b"] });
  });
});

describe("existing duplicates (imported before the fix)", () => {
  it("finds the CSV + PDF pair and merging removes the doubled rows", async () => {
    const c = csv("bank-hdfc-format.qa.csv");
    const legacy = { ...c.accounts[0], id: "acc_csv", institution: "Bank", name: "Bank Savings" };
    const p = await pdf("bank-hdfc-locked.qa.pdf", "DEMO1234");
    const ds: LakshlyDataset = { ...emptyDataset(), accounts: [legacy, ...p.accounts], transactions: [...c.transactions.map((t) => ({ ...t, accountId: "acc_csv" })), ...p.transactions] };
    expect(sum(ds, 1)).toBe(2 * CREDITS);
    const pairs = findDuplicateAccounts(ds);
    expect(pairs).toEqual([{ keepId: p.accounts[0].id, dropId: "acc_csv", reason: "overlap", overlap: F.BANK_TXNS.length }]);
    const { dataset, removed } = mergeAccounts(ds, pairs[0].dropId, pairs[0].keepId);
    expect(removed).toBe(F.BANK_TXNS.length);
    expect(dataset.accounts).toHaveLength(1);
    expect(sum(dataset, 1)).toBe(CREDITS);
    expect(netWorth(dataset)).toBe(F.BANK_CLOSING);
    expect(findDuplicateAccounts(dataset)).toEqual([]);
  });
});

describe("description matching tolerates format differences", () => {
  it("masking, case, punctuation and truncation", () => {
    expect(sameDescription("UPI-SWIGGY-swiggy@demo-123456789012-Food order", "UPI-SWIGGY-SWIGGY@DEMO-XXXX9012-FOOD ORDER")).toBe(true);
    expect(sameDescription("NEFT CR-DEMO EMPLOYER PVT LTD-SALARY SEP 2026", "NEFT CR DEMO EMPLOYER PVT LTD")).toBe(true);
    expect(sameDescription("UPI-SWIGGY Food order", "ATM WDL DEMO ATM BLR")).toBe(false);
  });
});
