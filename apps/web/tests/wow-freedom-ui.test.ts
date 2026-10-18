import { describe, expect, it } from "vitest";
import type { Debt } from "../lib/schema.gen";
import {
  baseline, clearedPercent, dayCount, freedomHeadline, monthLabel, noLoansCopy, overviewLine, payoffLabel,
  sliderCeiling, soonerText, stuckLines, unscheduledNote, whatIfDateLine,
} from "../lib/wow/freedom";
import { extraPaiseMax } from "../lib/wow/state";

function debt(
  id: string,
  name: string,
  principal: number,
  outstanding: number,
  rate: number,
  emi: number,
  kind: Debt["kind"] = "personal_loan",
): Debt {
  return {
    id, name, kind, lender: "Sample Lender", principal, outstanding, annualRatePct: rate, emi,
    startDate: "2026-01-01", tenureMonths: 12,
  };
}

const now = new Date(2026, 0, 15);

describe("freedom date copy", () => {
  it("labels a month and counts days", () => {
    expect(monthLabel("2028-10")).toBe("Oct 2028");
    expect(monthLabel("2026-03")).toBe("Mar 2026");
    expect(monthLabel("2026-13")).toBe("2026-13");
    expect(monthLabel("nope")).toBe("nope");
    expect(dayCount(762)).toBe("762 days");
    expect(dayCount(1)).toBe("1 day");
    expect(dayCount(0)).toBe("0 days");
    expect(dayCount(-4)).toBe("0 days");
    expect(dayCount(1000)).toBe("1,000 days");
    expect(dayCount(1234567)).toBe("1,234,567 days");
  });

  it("builds the debt-free headline and the overview line", () => {
    const loan = debt("loan", "Demo personal loan", 12_000, 12_000, 12, 5_000);
    const plan = baseline([loan], now);
    expect(plan.freedomMonth).toBe("2026-03");
    expect(freedomHeadline([loan], plan, now)).toEqual({
      title: "Debt-free by Mar 2026",
      days: "76 days to go",
      stuck: [],
    });
    expect(overviewLine([loan], now)).toBe("Debt-free by Mar 2026 · 76 days");
    expect(overviewLine([], now)).toBe(noLoansCopy);
    expect(payoffLabel("2026-03")).toBe("Mar 2026");
    expect(payoffLabel(null)).toBe("Not clearing");
    expect(soonerText(0)).toBe("0 months sooner");
    expect(soonerText(1)).toBe("1 month sooner");
    expect(soonerText(6)).toBe("6 months sooner");
  });

  it("keeps an unscheduled loan off the date and still names the month", () => {
    const loan = debt("loan", "Demo personal loan", 12_000, 12_000, 12, 5_000);
    const family = debt("family", "Demo family loan", 10_000, 10_000, 0, 0, "family");
    const plan = baseline([loan, family], now);
    expect(overviewLine([loan, family], now)).toBe("Debt-free by Mar 2026 · 76 days");
    expect(unscheduledNote(family.name)).toBe("Also tracked: Demo family loan (no fixed schedule)");
    expect(plan.unscheduled.map((item) => item.id)).toEqual(["family"]);
  });

  it("uses the stuck copy when an EMI does not cover interest", () => {
    const trap = debt("trap", "Demo interest trap", 100_000, 100_000, 12, 500);
    const plan = baseline([trap], now);
    expect(stuckLines([trap], plan)).toEqual(["Demo interest trap: the EMI does not cover interest."]);
    expect(freedomHeadline([trap], plan, now)).toEqual({
      title: null,
      days: null,
      stuck: ["Demo interest trap: the EMI does not cover interest."],
    });
    expect(overviewLine([trap], now)).toBe("Demo interest trap: the EMI does not cover interest.");
    expect(whatIfDateLine(plan)).toBe("No freedom date yet");
    expect(stuckLines([trap], plan, false)).toEqual(["Demo interest trap: the EMI does not cover interest."]);

    const other = debt("other", "Demo second trap", 100_000, 100_000, 12, 500);
    expect(overviewLine([trap, other], now)).toBe("An EMI does not cover interest.");
  });

  it("says there is no fixed EMI when nothing is scheduled", () => {
    const family = debt("family", "Demo family loan", 10_000, 10_000, 0, 0, "family");
    const plan = baseline([family], now);
    expect(overviewLine([family], now)).toBe("No fixed EMI yet");
    expect(freedomHeadline([family], plan, now)).toEqual({ title: "No fixed EMI yet", days: null, stuck: [] });
    expect(whatIfDateLine(plan)).toBe("No freedom date yet");
    expect(stuckLines([family], plan, false)).toEqual([]);
    expect(stuckLines([family], plan)).toEqual(["This plan is not clearing yet."]);
  });

  it("names a loan that is not clearing yet", () => {
    const slow = debt("slow", "Demo slow loan", 10_000_000, 10_000_000, 12, 100_001);
    expect(overviewLine([slow], now)).toBe("Demo slow loan is not clearing on this EMI yet.");
    const other = debt("other", "Demo other slow loan", 10_000_000, 10_000_000, 12, 100_001);
    expect(overviewLine([slow, other], now)).toBe("This plan is not clearing yet");
    const trap = debt("trap", "Demo interest trap", 100_000, 100_000, 12, 500);
    expect(overviewLine([trap, slow], now)).toBe("Demo interest trap: the EMI does not cover interest.");
  });

  it("rounds cleared principal and caps the extra slider", () => {
    expect(clearedPercent([])).toBe(0);
    const done = debt("done", "Demo done", 80, 20, 0, 10);
    const open = debt("open", "Demo open", 80, 80, 0, 10);
    expect(clearedPercent([done, open])).toBe(38);
    expect(sliderCeiling([])).toBe(50_000);
    expect(sliderCeiling([debt("a", "Demo loan", 80_000, 80_000, 0, 40_000)])).toBe(100_000);
    const huge = debt("huge", "Demo huge loan", extraPaiseMax, extraPaiseMax, 0, extraPaiseMax);
    expect(sliderCeiling([huge])).toBe(extraPaiseMax);
  });
});
