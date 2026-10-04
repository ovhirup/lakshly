import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dataset } from "@/lib/data";
import { complaintText, copyComplaint, familyLoans, namedRefunds, tatStatus } from "@/lib/owed";
import { netWorth } from "@/lib/selectors";
import type { Account, Debt, Transaction } from "@/lib/schema.gen";

const txn = (over: Partial<Transaction>): Transaction => ({
  id: "t1", date: "2026-09-01", description: "UPI refund from Sample Store (Demo)", amount: 29900,
  category: "shopping", accountId: "a", ...over,
});

describe("owed to you", () => {
  it("lists only credits that name a refund", () => {
    const rows = namedRefunds([
      txn({}),
      txn({ id: "t2", description: "Groceries", merchant: "Sample Mart", amount: 40000 }),
      txn({ id: "t3", amount: -100, description: "refund attempt" }),
      txn({ id: "t4", description: "Salary", tags: ["refund"] }),
    ]);
    expect(rows.map((t) => t.id)).toEqual(["t4", "t1"]);
  });

  it("marks a UPI refund late after T+1", () => {
    const inside = tatStatus("upi", "2026-09-01", "2026-09-02");
    const late = tatStatus("upi", "2026-09-01", "2026-09-03");
    expect(inside.overdue).toBe(false);
    expect(late.overdue).toBe(true);
    expect(late.lateBy).toBe(1);
    expect(tatStatus("atm", "2026-09-01", "2026-09-06").overdue).toBe(false);
    expect(tatStatus("card", "2026-09-01", "2026-09-07").overdue).toBe(true);
  });

  it("writes a complaint with no link and does not use the network", async () => {
    const text = complaintText({
      channel: "upi", merchant: "Sample Store (Demo)", amountPaise: 29900,
      date: "2026-09-01", reference: "DEMO-UPI-1001", today: "2026-09-04",
    });
    expect(text).toContain("Sample Store (Demo)");
    expect(text).toContain("T+1");
    expect(text).toContain("was not sent anywhere");
    expect(text).not.toMatch(/https?:/i);

    const src = readFileSync(new URL("../lib/owed.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/\bfetch\b/);
    expect(src).not.toMatch(/XMLHttpRequest/);
    const seen: string[] = [];
    await copyComplaint(text, async (s) => { seen.push(s); });
    expect(seen).toEqual([text]);
  });

  it("counts an unlinked family loan as a liability and skips one already on an account", () => {
    const savings = { id: "sav", type: "savings", balance: 500000 } as Account;
    const loan = { id: "ln", type: "loan", balance: -25000 } as Account;
    const family = { id: "fam", kind: "family", outstanding: 100000 } as Debt;
    const linked = { id: "fam2", kind: "family", outstanding: 25000, accountId: "ln" } as Debt;
    expect(netWorth([savings], [family]).liabilities).toBe(100000);
    expect(netWorth([savings], [family]).net).toBe(400000);
    expect(netWorth([loan], [linked]).liabilities).toBe(25000);
  });

  it("includes the synthetic family loan in demo net worth", () => {
    const loans = familyLoans(dataset.debts ?? []);
    expect(loans.map((d) => d.lender)).toEqual(["Family (Demo)"]);
    const plain = netWorth(dataset.accounts);
    const withFamily = netWorth(dataset.accounts, dataset.debts);
    expect(withFamily.liabilities - plain.liabilities).toBe(1000000);
    expect(withFamily.net).toBe(withFamily.assets - withFamily.liabilities);
  });
});
