import { describe, expect, it } from "vitest";
import { cleanName, initial, parseProfile, renewsOn } from "../lib/profile";
import { EMPTY_UPSELL, markShown, mayShow, parseUpsell, snooze } from "../lib/upsell";

describe("profile (on-device name)", () => {
  it("cleans names: trims, collapses spaces, strips control/bidi characters, max 40", () => {
    expect(cleanName("  Priya   Sharma ")).toBe("Priya Sharma");
    expect(cleanName("A\u202eB\u0007C")).toBe("ABC");
    expect(cleanName("x".repeat(60))).toHaveLength(40);
  });
  it("parses stored profiles defensively", () => {
    expect(parseProfile(null)).toEqual({ v: 1, name: "" });
    expect(parseProfile("not json")).toEqual({ v: 1, name: "" });
    expect(parseProfile('{"name":"  Ravi ","premiumSince":"2026-10-03"}')).toEqual({ v: 1, name: "Ravi", premiumSince: "2026-10-03" });
    expect(parseProfile('{"name":42,"premiumSince":"soon"}')).toEqual({ v: 1, name: "" });
  });
  it("initial uses the first grapheme", () => {
    expect(initial("priya sharma")).toBe("P");
    expect(initial("अनु")).toBe("अ");
    expect(initial("")).toBe("");
  });
  it("demo renewal is one year after the start", () => { expect(renewsOn("2026-10-03")).toBe("2027-10-03"); });
});

describe("gentle upsell rules", () => {
  const t0 = new Date("2026-10-03T10:00:00+05:30");
  const days = (n: number) => new Date(t0.getTime() + n * 86_400_000);
  it("shows the first nudge, keeps showing the same one, waits 7 days before a different one", () => {
    expect(mayShow(EMPTY_UPSELL, "profile.card", t0)).toBe(true);
    const s = markShown(EMPTY_UPSELL, "profile.card", t0);
    expect(mayShow(s, "profile.card", days(1))).toBe(true);
    expect(mayShow(s, "budget.limit", days(6))).toBe(false);
    expect(mayShow(s, "budget.limit", days(7))).toBe(true);
  });
  it("Not now snoozes for 30 days", () => {
    const s = snooze(markShown(EMPTY_UPSELL, "profile.card", t0), "profile.card", 30, t0);
    expect(mayShow(s, "profile.card", days(29))).toBe(false);
    expect(mayShow(s, "profile.card", days(30))).toBe(true);
  });
  it("parses stored state defensively", () => {
    expect(parseUpsell("{bad")).toEqual(EMPTY_UPSELL);
    expect(parseUpsell('{"snoozed":{"a":"2026-11-01T00:00:00Z","b":5},"last":{"id":1}}')).toEqual({ v: 1, snoozed: { a: "2026-11-01T00:00:00Z" } });
  });
});
