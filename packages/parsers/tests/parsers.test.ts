import { describe, expect, it } from "vitest";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFileSync } from "node:fs";
import * as F from "./fixtures/synthetic.ts";
import { extract } from "./helpers.ts";
import { emptyDataset, mergeResult, parseCsv, parseDocument, PasswordRequiredError, mapPdfOpenError, pdfErrorMessage, rankAdapters, textDocFromLines, type ParseResult } from "../src/index.ts";

const schema = JSON.parse(readFileSync(new URL("../../schema/lakshly.schema.json", import.meta.url), "utf8"));
type AjvCtor = new (o: object) => { compile: (s: object) => ((d: unknown) => boolean) & { errors?: unknown } };
const AjvClass = ((Ajv2020 as unknown as { default?: AjvCtor }).default ?? Ajv2020) as unknown as AjvCtor;
const ajv = new AjvClass({ allErrors: true, strict: false });
const withFormats = ((addFormats as unknown as { default?: (a: unknown) => void }).default ?? addFormats) as unknown as (a: unknown) => void;
withFormats(ajv);
const validate = ajv.compile(schema);

function expectSchemaValid(r: ParseResult) {
  const { dataset } = mergeResult(emptyDataset(new Date("2026-10-01T00:00:00Z")), r);
  const ok = validate(dataset);
  if (!ok) throw new Error(JSON.stringify(validate.errors, null, 2));
  expect(ok).toBe(true);
}

const parse = async (bytes: Promise<Uint8Array>, password?: string) => parseDocument(await extract(await bytes, password));

const expectedBank = F.BANK_TXNS.map((t) => ({ date: `2026-09-${String(t.d).padStart(2, "0")}`, amount: t.amt }));

describe.each([
  ["HDFC Bank", "bank.hdfc", F.hdfcBankPdf, "4321"],
  ["SBI", "bank.sbi", F.sbiBankPdf, "6543"],
  ["ICICI Bank", "bank.icici", F.iciciBankPdf, "5678"],
  ["generic fallback (single amount column)", "bank.generic", F.genericBankPdf, "3333"],
])("bank statement: %s", (_name, adapter, make, mask) => {
  it("detects the layout and extracts every transaction with the right sign", async () => {
    const r = await parse(make());
    expect(r.adapter).toBe(adapter);
    expect(r.kind).toBe("bank");
    expect(r.transactions.map((t) => ({ date: t.date, amount: t.amount }))).toEqual(expectedBank);
    expect(r.accounts[0]).toMatchObject({ type: "savings", mask, balance: F.BANK_CLOSING, source: "statement" });
    expect(r.warnings).toEqual([]);
  });

  it("auto-categorises with on-device rules", async () => {
    const r = await parse(make());
    const cat = (needle: string) => r.transactions.find((t) => t.description.toUpperCase().includes(needle))?.category;
    expect(cat("SALARY")).toBe("income");
    expect(cat("RENT")).toBe("rent");
    expect(cat("SWIGGY")).toBe("dining");
    expect(cat("BIGBASKET")).toBe("groceries");
    expect(cat("ATM")).toBe("cash");
    expect(cat("CREDIT CARD")).toBe("transfers");
    expect(cat("SIP")).toBe("investments");
    expect(cat("UBER")).toBe("transport");
    expect(cat("NETFLIX")).toBe("subscriptions");
    expect(r.transactions.find((t) => t.description.includes("SWIGGY"))?.method).toBe("upi");
  });

  it("produces schema-valid output and never keeps full account numbers", async () => {
    const r = await parse(make());
    expectSchemaValid(r);
    const json = JSON.stringify(r);
    for (const full of ["50100000004321", "00000039876543", "0000111122223333", "123456789012"]) expect(json).not.toContain(full);
  });
});

describe("bank continuation lines and multi-page tables", () => {
  it("joins wrapped narration and re-detects the header on page 2", async () => {
    const r = await parse(F.hdfcBankPdf());
    expect(r.transactions.find((t) => t.description.includes("ZEPTO"))?.description).toContain("DEMO GROCERIES ORDER");
    expect(r.transactions.at(-1)?.description).toContain("NETFLIX");
    expect(r.meta[0]).toMatchObject({ periodFrom: "2026-09-01", periodTo: "2026-09-30", openingBalance: F.BANK_OPENING, closingBalance: F.BANK_CLOSING });
  });
});

describe.each([
  ["HDFC Bank card (summary box layout)", "card.hdfc", F.hdfcCardPdf, F.HDFC_CARD_TXNS, F.HDFC_CARD, "4417"],
  ["SBI Card (label : value layout)", "card.sbi", F.sbiCardPdf, F.SBI_CARD_TXNS, F.SBI_CARD, "9012"],
])("credit card statement: %s", (_name, adapter, make, txns, summary, mask) => {
  it("extracts transactions, total due, minimum due and due date", async () => {
    const r = await parse(make());
    expect(r.adapter).toBe(adapter);
    expect(r.kind).toBe("card");
    expect(r.transactions.map((t) => t.amount)).toEqual(txns.map((t) => (t.credit ? t.amt : -t.amt)));
    expect(r.meta[0]).toMatchObject({ totalDue: summary.totalDue, minDue: summary.minDue, dueDate: summary.dueDate, statementDate: summary.statementDate });
    expect(r.accounts[0]).toMatchObject({ type: "credit_card", mask, balance: -summary.totalDue, dueDay: Number(summary.dueDate.slice(8)), statementDay: Number(summary.statementDate.slice(8)) });
    expect(r.transactions.find((t) => /PAYMENT RECEIVED/.test(t.description))?.category).toBe("transfers");
    expectSchemaValid(r);
  });
});

describe("credit card: generic fallback", () => {
  it("parses an unknown card layout", async () => {
    const r = await parse(F.genericCardPdf());
    expect(r.adapter).toBe("card.generic");
    expect(r.transactions.map((t) => t.amount)).toEqual([-25000, 49900, -568110]);
    expect(r.meta[0]).toMatchObject({ totalDue: 543210, minDue: 30000, dueDate: "2026-09-25", statementDate: "2026-09-05" });
    expect(r.accounts[0].mask).toBe("3456");
    expectSchemaValid(r);
  });
});

describe("mutual fund CAS (CAMS / KFintech)", () => {
  it("extracts schemes, masked folios, units, NAV, value, transactions and SIPs", async () => {
    const r = await parse(F.casPdf());
    expect(r.adapter).toBe("cas.cams-kfintech");
    expect(r.accounts).toHaveLength(3);
    for (const [i, s] of F.CAS_SCHEMES.entries()) {
      const h = r.holdings[i];
      expect(h.scheme).toBe(s.scheme);
      expect(h.isin).toBe(s.isin);
      expect(h.units).toBeCloseTo(F.casClosingUnits(s), 3);
      expect(h.nav).toBeCloseTo(s.nav, 4);
      expect(h.marketValue).toBe(F.casMarketValue(s));
      expect(h.costValue).toBe(s.cost);
      expect(h.registrar).toBe(s.registrar === "CAMS" ? "CAMS" : "KFintech");
      expect(r.accounts[i]).toMatchObject({ type: "mutual_fund", balance: F.casMarketValue(s), invested: s.cost, source: "cas", asOf: "2026-09-30" });
    }
    expect(r.accounts.map((a) => a.mask)).toEqual(["4567", "4567", "0011"]);
    expect(JSON.stringify(r)).not.toContain("91234567");
    // Stamp-duty lines are skipped; redemption is negative.
    expect(r.transactions).toHaveLength(14);
    expect(r.transactions.find((t) => t.description === "Redemption")?.amount).toBe(-1000000);
    expect(r.sips).toEqual([
      expect.objectContaining({ amount: 500000, dayOfMonth: 5, startDate: "2026-04-05", status: "active", platform: "CAMS" }),
      expect.objectContaining({ amount: 300000, dayOfMonth: 10, startDate: "2026-04-10", status: "active" }),
    ]);
    expectSchemaValid(r);
  });
});

describe.each([
  ["NSDL", F.nsdlCasPdf, "nsdl", [652000, 486006, 1003753, 255000], ["1357", "2468", "1234", "5678"], 2396759, 3],
  ["CDSL", F.cdslCasPdf, "cdsl", [486006, 1003753], ["2468", "1234"], 1489759, 2],
] as const)("depository CAS: %s", (_name, make, issuer, balances, masks, totalValue, movements) => {
  it("detects and parses exact demat and folio valuations", async () => {
    const doc = await extract(await make());
    expect(rankAdapters(doc)[0]).toMatchObject({ adapter: { id: "cas.depository" } });
    expect(rankAdapters(doc)[0].score).toBeGreaterThanOrEqual(0.8);
    const r = parseDocument(doc);
    expect(r.adapter).toBe("cas.depository");
    expect(r.accounts.map((a) => a.balance)).toEqual(balances);
    expect(r.accounts.map((a) => a.mask)).toEqual(masks);
    expect(r.accounts.filter((a) => a.type === "stocks")).toHaveLength(issuer === "nsdl" ? 2 : 1);
    for (const a of r.accounts) expect(a).toMatchObject({ asOf: "2026-08-31", source: "cas", currency: "INR" });
    expect(r.accounts.find((a) => a.mask === "2468")).toMatchObject({ institution: "CDSL / Demo Securities Ltd", type: "stocks" });
    expect(r.accounts.find((a) => a.mask === "1234")).toMatchObject({ type: "mutual_fund", invested: 900000 });
    expect(r.accounts.filter((a) => a.type === "stocks").every((a) => a.invested === undefined)).toBe(true);
    expect(r.holdings.find((h) => h.isin === "INF000K01AB1")).toMatchObject({ units: 125.125, nav: 32.48, marketValue: 406406, costValue: 0, accountId: r.accounts.find((a) => a.mask === "2468")!.id });
    expect(r.holdings.find((h) => h.isin === "INF000K01AB2")).toMatchObject({ units: 200.25, nav: 50.125, marketValue: 1003753, costValue: 900000 });
    if (issuer === "nsdl") {
      expect(r.accounts[0].institution).toBe("NSDL / Demo Securities Ltd");
      expect(r.holdings[0]).toMatchObject({ isin: "INE000A01011", units: 12.5, nav: 120.4, marketValue: 150500 });
      expect(r.holdings[1]).toMatchObject({ isin: "INE000A01013", units: 20, nav: 250.75, marketValue: 501500 });
      expect(r.accounts.at(-1)?.invested).toBe(240000);
      expect(r.holdings.at(-1)).toMatchObject({ units: 100, nav: 25.5, marketValue: 255000 });
    }
    expect(r.holdings.find((h) => h.isin === "INE000A01012")).toMatchObject({ units: 8, nav: 99.5, marketValue: 79600 });
    expect(r.meta[0]).toMatchObject({ adapter: "cas.depository", issuer, periodFrom: "2026-08-01", periodTo: "2026-08-31", totalValue, quantityTransactionCount: movements });
    expect(r.accounts.reduce((sum, a) => sum + a.balance, 0)).toBe(totalValue);
    expect(r.transactions).toEqual([]);
    expect(r.sips).toEqual([]);
    expect(r.warnings).toEqual([]);
    expectSchemaValid(r);
    const json = JSON.stringify(r);
    for (const identifier of ["IN30000001", "00001357", "1200000000002468", "70001234", "70005678"]) expect(json).not.toContain(identifier);
    const text = doc.lines.map((l) => l.text).join("\n");
    expect(text).toContain("SYNTHETIC");
    expect(text).toContain("Asha Demo");
    expect(text).not.toMatch(/\b[A-Z]{5}\d{4}[A-Z]\b/);
  });

  it("adds no accounts or transactions when re-imported", async () => {
    const firstResult = await parse(make());
    const secondResult = await parse(make());
    expect(secondResult.accounts.map((a) => a.id)).toEqual(firstResult.accounts.map((a) => a.id));
    const now = new Date("2026-10-01T00:00:00Z");
    const first = mergeResult(emptyDataset(now), firstResult, now);
    const again = mergeResult(first.dataset, secondResult, now);
    expect(first.report.accountsAdded).toBe(balances.length);
    expect(again.report).toEqual({ added: 0, duplicates: 0, accountsAdded: 0, accountsUpdated: balances.length, sipsUpserted: 0 });
    expect(again.dataset).toEqual(first.dataset);
  });
});

describe("depository CAS detection and passwords", () => {
  it("supports separate ID labels, scheme/folio grouping, unknown cost and optional transactions", () => {
    const r = parseDocument(textDocFromLines([
      "Consolidated Account Statement - SYNTHETIC", "NSDL", "Statement for the period from 01-Aug-2026 to 31-Aug-2026",
      "NSDL Demat Account", "DP Name: Demo Securities Ltd", "DP ID: IN300001", "Client ID: 00001357",
      "Equities (E)", "INE000A01011 Demo Industries Ltd 12.5 10.5 2 120.40 1,505.00",
      "CDSL Demat Account", "DP Name: Demo Securities Ltd", "DP ID: 12000000", "Client ID: 00002468",
      "INE000A01012 Demo Tools Ltd 8 6 2 99.50 796.00",
      "Mutual Fund Units held with RTAs (MF Folios)",
      "Demo Balanced Fund INF000K01AB2 70001234 / 12 200.25 50.125 - 10,037.53 -",
      "Demo Short Term Fund INF000K01AB3 70001234 / 12 100 25.5 2,400.00 2,550.00 150.00",
    ]));
    expect(r.accounts.map((a) => [a.type, a.mask, a.balance])).toEqual([
      ["stocks", "1357", 150500], ["stocks", "2468", 79600], ["mutual_fund", "1234", 1003753], ["mutual_fund", "1234", 255000],
    ]);
    expect(new Set(r.accounts.map((a) => a.id)).size).toBe(4);
    expect(r.accounts[2].invested).toBeUndefined();
    expect(r.holdings[2].costValue).toBe(0);
    expect(r.accounts[3].invested).toBe(240000);
    expect(r.meta[0]).toMatchObject({ totalValue: 1488853, quantityTransactionCount: 0 });
    expect(r.warnings).toEqual([]);
    expectSchemaValid(r);
    for (const identifier of ["IN300001", "00001357", "12000000", "00002468", "70001234"]) expect(JSON.stringify(r)).not.toContain(identifier);
  });

  it("requires title, issuer and demat markers and leaves CAMS/KFintech routing intact", async () => {
    const score = (lines: string[]) => rankAdapters(textDocFromLines(lines)).find((a) => a.adapter.id === "cas.depository")!.score;
    expect(score(["Consolidated Account Statement", "NSDL", "DP ID: IN30000001"])).toBeGreaterThanOrEqual(0.8);
    expect(score(["Consolidated Account Statement", "Central Depository Services (India) Limited", "BO ID: 1200000000002468"])).toBeGreaterThanOrEqual(0.8);
    expect(score(["Consolidated Account Statement", "CDSL", "Demat Account"])).toBeGreaterThanOrEqual(0.8);
    expect(score(["CAS - SYNTHETIC", "CDSL", "BO ID: 1200000000002468"])).toBeGreaterThanOrEqual(0.8);
    expect(score(["Account Statement", "NSDL", "DP ID"])).toBe(0);
    expect(score(["Consolidated Account Statement", "NSDL"])).toBe(0);
    expect(score(["Consolidated Account Statement", "DP ID"])).toBe(0);
    for (const password of [undefined, F.PASSWORD]) {
      const doc = await extract(await F.casPdf(password), password);
      expect(parseDocument(doc).adapter).toBe("cas.cams-kfintech");
      expect(rankAdapters(doc).find((a) => a.adapter.id === "cas.depository")!.score).toBe(0);
      // Incidental depository text in a detailed RTA CAS must not change its route.
      const augmented = textDocFromLines([...doc.lines.map((l) => l.text), "NSDL Demat Account"]);
      expect(parseDocument(augmented).adapter).toBe("cas.cams-kfintech");
      expect(rankAdapters(augmented).find((a) => a.adapter.id === "cas.depository")!.score).toBe(0);
    }
  });

  it("uses the existing password errors and matches the unlocked CDSL result", async () => {
    const bytes = await F.cdslCasPdf(F.PASSWORD);
    await expect(extract(bytes.slice())).rejects.toBeInstanceOf(PasswordRequiredError);
    await expect(extract(bytes.slice())).rejects.toMatchObject({ incorrect: false });
    await expect(extract(bytes.slice(), "wrong")).rejects.toMatchObject({ name: "PasswordRequiredError", incorrect: true });
    const locked = parseDocument(await extract(bytes.slice(), F.PASSWORD));
    expect(locked).toEqual(await parse(F.cdslCasPdf()));
    expect(JSON.stringify(locked)).not.toContain(F.PASSWORD);
    expectSchemaValid(locked);
  });
});

describe("password-protected PDFs", () => {
  it("asks for a password, rejects a wrong one, and opens with the right one", async () => {
    const bytes = await F.hdfcBankPdf(F.PASSWORD);
    await expect(extract(bytes.slice())).rejects.toMatchObject({ name: "PasswordRequiredError", incorrect: false });
    await expect(extract(bytes.slice(), "wrong")).rejects.toBeInstanceOf(PasswordRequiredError);
    await expect(extract(bytes.slice(), "wrong")).rejects.toMatchObject({ incorrect: true });
    const r = parseDocument(await extract(bytes.slice(), F.PASSWORD));
    expect(r.adapter).toBe("bank.hdfc");
    expect(r.transactions).toHaveLength(F.BANK_TXNS.length);
  });

  it("opens a locked CAS", async () => {
    const r = parseDocument(await extract(await F.casPdf(F.PASSWORD), F.PASSWORD));
    expect(r.accounts).toHaveLength(3);
  });
});

describe("dedupe on re-import", () => {
  it("is idempotent and keeps genuine same-day repeats", async () => {
    const r = await parse(F.hdfcBankPdf());
    const first = mergeResult(emptyDataset(), r);
    expect(first.report).toMatchObject({ added: F.BANK_TXNS.length, duplicates: 0, accountsAdded: 1 });
    const again = mergeResult(first.dataset, await parse(F.sbiBankPdf()));
    expect(again.report.accountsAdded).toBe(1); // different bank → different account
    const same = mergeResult(first.dataset, await parse(F.hdfcBankPdf(F.PASSWORD), F.PASSWORD));
    expect(same.report).toMatchObject({ added: 0, duplicates: F.BANK_TXNS.length, accountsAdded: 0, accountsUpdated: 1 });
    expect(same.dataset.transactions).toHaveLength(F.BANK_TXNS.length);
  });
});

describe("CSV export", () => {
  it("parses a generic Date/Description/Debit/Credit/Balance CSV", () => {
    const csv = [
      "Date,Description,Debit,Credit,Balance",
      "01/09/2026,\"NEFT CR-DEMO EMPLOYER, SALARY\",,\"1,25,000.00\",\"1,85,000.00\"",
      "03/09/2026,UPI-SWIGGY-swiggy@demo-123456789012-Food,450.00,,\"1,84,550.00\"",
      "05/09/2026,POS DEMO BIGBASKET,\"2,345.50\",,\"1,82,204.50\"",
    ].join("\n");
    const r = parseCsv(csv, "demo.csv");
    expect(r.transactions.map((t) => [t.date, t.amount, t.category])).toEqual([
      ["2026-09-01", 12500000, "income"], ["2026-09-03", -45000, "dining"], ["2026-09-05", -234550, "groceries"],
    ]);
    expectSchemaValid(r);
  });
});

describe("password errors are mapped precisely (regression: Gmail CAS reported as wrong password)", () => {
  it("pdf.js detaches the bytes it is given, so every attempt needs its own copy", async () => {
    const bytes = await F.casPdf(F.PASSWORD);
    const shared = bytes.slice();
    await expect(extract(shared)).rejects.toMatchObject({ name: "PasswordRequiredError", incorrect: false });
    expect(shared.byteLength).toBe(0); // detached: reusing it would fail even with the right password
    const r = parseDocument(await extract(bytes.slice(), F.PASSWORD)); // a fresh copy works
    expect(r.accounts).toHaveLength(3);
  });
  it("wrong then right password on fresh copies opens the CAS", async () => {
    const bytes = await F.casPdf(F.PASSWORD);
    await expect(extract(bytes.slice(), "nope")).rejects.toMatchObject({ incorrect: true });
    await expect(extract(bytes.slice(), F.PASSWORD.toLowerCase())).rejects.toMatchObject({ incorrect: true }); // case-sensitive, never altered
    expect(parseDocument(await extract(bytes.slice(), F.PASSWORD)).accounts).toHaveLength(3);
  });
  it("a damaged/truncated PDF is never reported as a wrong password", async () => {
    const bytes = await F.casPdf(F.PASSWORD);
    const err = await extract(bytes.slice(0, 40), F.PASSWORD).catch((e) => e);
    expect(err).not.toBeInstanceOf(PasswordRequiredError);
    expect(pdfErrorMessage(err)).toMatch(/valid PDF|Couldn't read/);
  });
  it("maps only code 2 to incorrect and code 1 to needs-password", () => {
    expect(mapPdfOpenError({ name: "PasswordException", code: 2 })).toMatchObject({ name: "PasswordRequiredError", incorrect: true });
    expect(mapPdfOpenError({ name: "PasswordException", code: 1 })).toMatchObject({ name: "PasswordRequiredError", incorrect: false });
    const other = mapPdfOpenError(Object.assign(new Error("Invalid PDF structure."), { name: "InvalidPDFException" }));
    expect(other).not.toBeInstanceOf(PasswordRequiredError);
    expect(pdfErrorMessage(other)).toMatch(/isn't a valid PDF/);
  });
});

describe("shared CAS folio identity and saved legacy migration", () => {
  const cams = () => parseDocument(textDocFromLines([
    "Consolidated Account Statement", "01-Aug-2026 To 31-Aug-2026", "Demo Mutual Fund",
    "Folio No: 70001234 / 12   PAN: OK",
    "Demo Fund   ISIN: INF000K01AB2   Registrar : CAMS",
    "Closing Unit Balance: 125.125   NAV on 31-Aug-2026: INR 80.2200   Total Cost Value: 9,000.00   Market Value on 31-Aug-2026: INR 10,037.53",
  ]));
  const depos = () => parseDocument(textDocFromLines([
    "NSDL Consolidated Account Statement", "01-Aug-2026 To 31-Aug-2026", "Demat Account",
    "Mutual Fund Units held with RTAs (MF Folios)",
    "Demo Fund INF000K01AB2 70001234 / 12 125.125 80.22 9000.00 10037.53 -",
  ]));
  it("merges either adapter order and repeats without doubling a folio", () => {
    for (const results of [[cams(), depos()], [depos(), cams()]]) {
      let dataset = emptyDataset();
      for (const result of [...results, ...results]) dataset = mergeResult(dataset, result).dataset;
      expect(dataset.accounts).toHaveLength(1);
      expect(dataset.accounts[0].balance).toBe(1003753);
      expect(results[0].accounts[0].id).toBe(results[1].accounts[0].id);
      expect(results[0].accountAliases).toEqual(results[1].accountAliases);
      expect(JSON.stringify(results)).not.toContain("70001234");
    }
  });
  it("migrates a legacy-only account through either adapter without counting an addition", () => {
    for (const result of [cams(), depos()]) {
      const [legacy] = Object.keys(result.accountAliases!);
      const base = { ...emptyDataset(), accounts: [{ ...result.accounts[0], id: legacy }] };
      const merged = mergeResult(base, result);
      expect(merged.dataset.accounts.map((a) => a.id)).toEqual([result.accounts[0].id]);
      expect(merged.report.accountsAdded).toBe(0);
      expect(base.accounts[0].id).toBe(legacy);
    }
  });
  it("collapses already saved copies using the newest snapshot in either direction and preserves invested", () => {
    const result = depos(), [legacy] = Object.keys(result.accountAliases!);
    for (const legacyNewer of [false, true]) {
      const canonical = { ...result.accounts[0], invested: undefined, asOf: legacyNewer ? "2026-08-31" : "2026-10-01", balance: 2000000 };
      const old = { ...result.accounts[0], id: legacy, asOf: legacyNewer ? "2026-10-01" : "2026-08-31", balance: 3000000 };
      const merged = mergeResult({ ...emptyDataset(), accounts: [old, canonical] }, result);
      expect(merged.dataset.accounts).toHaveLength(1);
      expect(merged.dataset.accounts[0]).toMatchObject({ balance: legacyNewer ? 3000000 : 2000000, invested: 900000, asOf: "2026-10-01" });
    }
  });
  it("prefers the original canonical copy on equal dates regardless of order", () => {
    const result = depos(), [legacy] = Object.keys(result.accountAliases!);
    const canonical = { ...result.accounts[0], asOf: "2026-10-01", balance: 2000000 };
    const old = { ...canonical, id: legacy, balance: 3000000 };
    for (const accounts of [[old, canonical], [canonical, old]]) expect(mergeResult({ ...emptyDataset(), accounts }, result).dataset.accounts[0].balance).toBe(2000000);
  });
  it("remaps all saved and incoming references without changing IDs or other fields or mutating inputs", () => {
    const result = depos(), [legacy] = Object.keys(result.accountAliases!), canonical = result.accounts[0].id;
    const txn = { id: "txn_demo1234", accountId: legacy, date: "2026-08-01", amount: 100, description: "Demo", category: "investments" as const };
    const sip = { id: "sip_demo1234", scheme: "Demo", amount: 100, dayOfMonth: 1, startDate: "2026-08-01", status: "active" as const, accountId: legacy };
    const debt = { id: "debt_demo1234", name: "Demo", kind: "personal_loan" as const, principal: 100, outstanding: 100, annualRatePct: 1, emi: 1, startDate: "2026-08-01", tenureMonths: 1, accountId: legacy };
    const reward = { id: "reward_demo1234", program: "Demo", kind: "points" as const, balance: 100, accountId: legacy, asOf: "2026-08-01" };
    const base = { ...emptyDataset(), accounts: [{ ...result.accounts[0], id: legacy }], transactions: [txn], sips: [sip], debts: [debt], rewards: [reward] };
    const incoming = { ...result, transactions: [{ ...txn, id: "txn_incoming" }], sips: [{ ...sip, id: "sip_incoming" }] };
    const before = JSON.stringify({ base, incoming });
    const merged = mergeResult(base, incoming).dataset;
    expect(merged.transactions).toEqual([txn, incoming.transactions[0]].map((x) => ({ ...x, accountId: canonical })));
    expect(merged.sips).toEqual([sip, incoming.sips[0]].map((x) => ({ ...x, accountId: canonical })));
    expect(merged.debts).toEqual([{ ...debt, accountId: canonical }]);
    expect(merged.rewards).toEqual([{ ...reward, accountId: canonical }]);
    expect(JSON.stringify({ base, incoming })).toBe(before);
    const withoutOptional = emptyDataset();
    delete withoutOptional.debts; delete withoutOptional.rewards;
    const mergedWithout = mergeResult(withoutOptional, result).dataset;
    expect(mergedWithout).not.toHaveProperty("debts");
    expect(mergedWithout).not.toHaveProperty("rewards");
  });
  it("does not alias masked folios or a scheme with no ISIN", () => {
    for (const [folio, isin] of [["7000XXXX / 12", "ISIN: INF000K01AB2"], ["70001234 / 12", ""]]) {
      const parsed = parseDocument(textDocFromLines([
        "Consolidated Account Statement", "01-Aug-2026 To 31-Aug-2026", "Demo Mutual Fund",
        `Folio No: ${folio}   PAN: OK`, `Demo Fund   ${isin}   Registrar : CAMS`,
        "Closing Unit Balance: 125.125   NAV on 31-Aug-2026: INR 80.2200   Market Value on 31-Aug-2026: INR 10,037.53",
      ]));
      expect(parsed.accounts).toHaveLength(1);
      expect(parsed.accountAliases).toBeUndefined();
    }
  });
  it("rejects non-MF sources and alias chains or cycles", () => {
    const result = depos(), [legacy] = Object.keys(result.accountAliases!), canonical = result.accounts[0].id;
    const base = { ...emptyDataset(), accounts: [{ ...result.accounts[0], id: legacy, type: "stocks" as const }] };
    expect(mergeResult(base, result).accountAliases).toEqual({});
    for (const accountAliases of [{ [legacy]: canonical, [canonical]: legacy }, { [legacy]: canonical, other: legacy }]) {
      expect(mergeResult(emptyDataset(), { ...result, accountAliases }).accountAliases).toEqual({});
    }
  });
});
