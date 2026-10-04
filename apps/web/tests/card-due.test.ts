import { describe, expect, it } from "vitest";
import { cardDueSoon, cardDueWhen, daysUntil, nextDueDate } from "../lib/card-due";

describe("card payment reminder", () => {
  it("stays quiet until three days before the due day", () => {
    expect(nextDueDate(25, "2026-10-04")).toBe("2026-10-25");
    expect(cardDueSoon(daysUntil("2026-10-04", "2026-10-25"))).toBe(false);
    expect(cardDueSoon(daysUntil("2026-10-21", "2026-10-25"))).toBe(false);
    expect(cardDueSoon(daysUntil("2026-10-22", "2026-10-25"))).toBe(true);
    expect(cardDueSoon(daysUntil("2026-10-25", "2026-10-25"))).toBe(true);
  });

  it("rolls to next month once the due day has passed", () => {
    expect(nextDueDate(25, "2026-10-26")).toBe("2026-11-25");
    expect(cardDueSoon(daysUntil("2026-10-26", nextDueDate(25, "2026-10-26")))).toBe(false);
  });

  it("clamps a 31st due day to the last day of a short month", () => {
    expect(nextDueDate(31, "2026-02-01")).toBe("2026-02-28");
  });

  it("names today and tomorrow without a count", () => {
    expect(cardDueWhen(0)).toBe("today");
    expect(cardDueWhen(1)).toBe("tomorrow");
    expect(cardDueWhen(3)).toBe("in 3 days");
  });
});
