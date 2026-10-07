import { beforeEach, describe, expect, it } from "vitest";
import { dataset } from "@/lib/data";
import { formatINR, formatINRCompact } from "@/lib/format";
import { complaintText } from "@/lib/owed";
import { setFormatMask } from "@/lib/privacy";
import { budgetProgress, defaultMonth, netWorth, netWorthHistory, planFor } from "@/lib/selectors";

// WP1 Principle 1: the existing INR dataset must give byte-identical output after every phase.
// If this fails after a currency change, India behaviour regressed. Update the golden only with intent: vitest -u.
describe("golden INR output (synthetic dataset)", () => {
  beforeEach(() => setFormatMask(false, false));

  it("matches the pinned snapshot", async () => {
    const { accounts, debts = [], transactions, budgets = [] } = dataset;
    const nw = netWorth(accounts, debts);
    const month = defaultMonth(transactions);
    const progress = budgetProgress(planFor(budgets, month), transactions, month);
    const golden = {
      month,
      netWorth: {
        raw: nw,
        net: formatINR(nw.net),
        netCompact: formatINRCompact(nw.net),
        assets: formatINR(nw.assets),
        liabilities: formatINR(nw.liabilities),
      },
      history: netWorthHistory(accounts, transactions).map((p) => ({ ...p, netText: formatINR(p.net), compact: formatINRCompact(p.net) })),
      budgets: progress.map((b) => ({
        ...b,
        spentText: formatINR(b.spent),
        limitText: formatINR(b.limit),
        leftText: formatINR(b.left),
      })),
      complaint: complaintText({
        channel: "upi",
        merchant: "Synthetic Store",
        amountPaise: 123456,
        date: "2026-09-01",
        reference: "",
        today: "2026-09-10",
      }),
    };
    await expect(JSON.stringify(golden, null, 1) + "\n").toMatchFileSnapshot("./__golden__/inr-golden.json");
  });
});
