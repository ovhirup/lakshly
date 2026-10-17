import { describe, expect, it } from "vitest";
import { openStoryMonths, storyMonthOpen } from "../lib/wow/story";

const months = ["2026-07", "2026-08", "2026-09"];

describe("story months a tier can open", () => {
  it("lets Free open only the latest month", () => {
    expect(openStoryMonths(months, false)).toEqual(["2026-09"]);
    expect(storyMonthOpen("2026-09", months, false)).toBe(true);
    expect(storyMonthOpen("2026-08", months, false)).toBe(false);
    expect(storyMonthOpen("2026-07", months, false)).toBe(false);
  });

  it("lets Premium open every month in the list", () => {
    expect(openStoryMonths(months, true)).toEqual(months);
    expect(storyMonthOpen("2026-07", months, true)).toBe(true);
  });

  it("opens the only month on Free", () => {
    expect(openStoryMonths(["2026-09"], false)).toEqual(["2026-09"]);
  });

  it("opens nothing when there are no months, and ignores a month outside the list", () => {
    expect(openStoryMonths([], true)).toEqual([]);
    expect(storyMonthOpen("2026-01", months, true)).toBe(false);
    expect(storyMonthOpen("2026-09", [], false)).toBe(false);
  });
});
