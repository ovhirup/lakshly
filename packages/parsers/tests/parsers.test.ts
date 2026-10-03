import { describe, expect, it } from "vitest";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFileSync } from "node:fs";
import * as F from "./fixtures/synthetic.ts";
import { extract } from "./helpers.ts";
import { emptyDataset, mergeResult, parseCsv, parseDocument, PasswordRequiredError, mapPdfOpenError, pdfErrorMessage, type ParseResult } from "../src/index.ts";

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
