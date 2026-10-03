import { describe, expect, it } from "vitest";
import { confirmImportLabel, importCounts } from "@/lib/import/review";

const tx = (id: string) => ({ id }) as never;
const holding = (accountId: string) => ({ accountId }) as never;

describe("importer confirm button", () => {
  it("counts holdings from a CAS with no transactions instead of showing (0)", () => {
    const counts = importCounts({ transactions: [], holdings: [holding("a"), holding("b"), holding("c")], sips: [] });
    expect(counts).toEqual({ transactions: 0, holdings: 3, sips: 0 });
    expect(confirmImportLabel(counts)).toBe("Confirm import (3 holdings)");
    expect(confirmImportLabel(counts)).not.toContain("(0)");
  });
  it("counts only included transactions, plus SIPs, with singular forms", () => {
    const counts = importCounts({ transactions: [tx("1"), tx("2"), tx("3")], holdings: [holding("a")], sips: [{} as never] }, { "2": true });
    expect(confirmImportLabel(counts)).toBe("Confirm import (2 transactions, 1 holding, 1 SIP)");
  });
  it("drops the count when nothing is countable", () => {
    expect(confirmImportLabel(importCounts({ transactions: [tx("1")], holdings: [], sips: [] }, { "1": true }))).toBe("Confirm import");
  });
});
