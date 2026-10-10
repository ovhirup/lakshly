import { describe, expect, it } from "vitest";
import { confirmImportLabel, importCounts, importToast, wrongPasswordMessage } from "@/lib/import/review";

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

const report = { added: 0, duplicates: 0, accountsAdded: 0, accountsUpdated: 0, sipsUpserted: 0 };

describe("import toast", () => {
  it("names the accounts a depository CAS saved, with no transaction count of zero", () => {
    const text = importToast({ ...report, accountsAdded: 4 });
    expect(text).toBe("Imported 4 accounts. Thank you for trusting Lakshly 💛");
    expect(text).not.toMatch(/0 new/);
  });
  it("says accounts were updated when the same CAS is imported again", () => {
    expect(importToast({ ...report, accountsUpdated: 4 })).toBe("Updated 4 accounts. Thank you for trusting Lakshly 💛");
  });
  it("keeps new transactions and mentions a new account and SIPs", () => {
    expect(importToast({ ...report, added: 1, accountsAdded: 1, sipsUpserted: 2 })).toBe("Imported 1 new transaction, 1 account, 2 SIPs. Thank you for trusting Lakshly 💛");
  });
  it("keeps the already-imported note on a repeat bank statement", () => {
    expect(importToast({ ...report, duplicates: 9, accountsUpdated: 1 })).toBe("Updated 1 account, skipped 9 already imported. Thank you for trusting Lakshly 💛");
  });
});

describe("wrong statement password", () => {
  it("points at the listed bank pattern", () => {
    expect(wrongPasswordMessage(true)).toBe("That password didn't work. Use one of the patterns listed above.");
    expect(wrongPasswordMessage(true)).not.toMatch(/Caps Lock/);
  });
  it("stays short when no pattern is listed", () => {
    expect(wrongPasswordMessage(false)).toBe("That password didn't work. Try again.");
  });
});

describe("cross-format import toast", () => {
  it("says the statement was matched to an existing account", () => {
    const r = { added: 0, duplicates: 12, accountsAdded: 0, accountsUpdated: 1, sipsUpserted: 0, matched: [{ incomingId: "a", baseId: "b", reason: "institution" as const, overlap: 12 }] };
    expect(importToast(r)).toBe("Updated 1 account, skipped 12 already imported. Matched to an account you already imported, so nothing is counted twice. Thank you for trusting Lakshly 💛");
  });
});

describe("confirm button counts only new rows when some are duplicates", () => {
  it("new-only wording", () => {
    expect(confirmImportLabel({ transactions: 0, holdings: 0, sips: 0, onlyNew: true })).toBe("Confirm import (no new transactions)");
    expect(confirmImportLabel({ transactions: 3, holdings: 0, sips: 0, onlyNew: true })).toBe("Confirm import (3 new transactions)");
    expect(confirmImportLabel({ transactions: 3, holdings: 0, sips: 0 })).toBe("Confirm import (3 transactions)");
  });
});
