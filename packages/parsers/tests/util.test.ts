import { describe, expect, it } from "vitest";
import { categorise, guessMerchant, last4, parseAmount, parseDate, stableId } from "../src/index.ts";
import { redactNumbers } from "../src/util/mask.ts";

describe("parseAmount → paise", () => {
  it.each([
    ["1,23,456.78", 12345678], ["450.00", 45000], ["Rs. 99.50", 9950], ["INR 1,000", 100000], ["5,000.00 Cr", 500000],
    ["5,000.00 Dr", -500000], ["(10,000.00)", -1000000], ["-12.30", -1230], ["1,234.00 D", -123400], ["2,00,000", 20000000],
  ])("%s", (s, p) => expect(parseAmount(s)).toBe(p));
  it("rejects non-amounts", () => {
    for (const s of ["", "abc", "12/09/2026", "1.2.3"]) expect(parseAmount(s)).toBeNull();
  });
});

describe("parseDate (day-first Indian formats)", () => {
  it.each([
    ["05/09/2026", "2026-09-05"], ["05/09/26", "2026-09-05"], ["5-9-2026", "2026-09-05"], ["05.09.2026", "2026-09-05"],
    ["05-Sep-2026", "2026-09-05"], ["5 Sep 2026", "2026-09-05"], ["05 Sep 26", "2026-09-05"], ["5-Sept-26", "2026-09-05"], ["2026-09-05", "2026-09-05"],
  ])("%s", (s, d) => expect(parseDate(s)).toBe(d));
  it("rejects impossible dates", () => {
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("13/13/2026")).toBeNull();
  });
});

describe("masking", () => {
  it("keeps only the last 4 digits", () => {
    expect(last4("50100000004321")).toBe("4321");
    expect(last4("XXXX XXXX XXXX 4417")).toBe("4417");
    expect(last4("12")).toBeUndefined();
  });
  it("redacts long digit runs in narrations", () => {
    expect(redactNumbers("UPI-ABC-123456789012-x")).toBe("UPI-ABC-XXXX9012-x");
    expect(redactNumbers("Instalment 13")).toBe("Instalment 13");
  });
});

describe("rules", () => {
  it("categorises common narrations", () => {
    expect(categorise("UPI-ZOMATO-x", -100)).toBe("dining");
    expect(categorise("NEFT SALARY", 100)).toBe("income");
    expect(categorise("REFUND XYZ", 100)).toBe("income");
    expect(categorise("SOMETHING", -100)).toBe("other");
  });
  it("guesses merchants", () => {
    expect(guessMerchant("UPI-SWIGGY-swiggy@demo-XXXX9012-Food")).toBe("Swiggy");
    expect(guessMerchant("POS 416021XXXXXX1234 BIGBASKET DEMO")).toBe("Bigbasket Demo");
  });
  it("makes stable schema-shaped ids", () => {
    expect(stableId("txn", "a", 1)).toMatch(/^txn_[a-z0-9]{6,}$/);
    expect(stableId("txn", "a", 1)).toBe(stableId("txn", "a", 1));
    expect(stableId("txn", "a", 1)).not.toBe(stableId("txn", "a", 2));
  });
});
