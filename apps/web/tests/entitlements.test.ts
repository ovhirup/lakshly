import { describe, expect, it } from "vitest";
import { can, limit } from "@/lib/entitlements";

const free = ["import.statements", "setup.wizard", "setup.emailGuide", "setup.extraEmails", "setup.suggestions", "setup.health", "mailSync.connect", "mailSync.imap", "mailSync.statementPasswordKeychain"];

describe("entitlements", () => {
  it("lists every setup feature as Free", () => {
    for (const f of free) expect(can(f, "free"), f).toBe(true);
  });
  it("keeps background sync and freshness reminders Premium", () => {
    expect(can("mailSync.background", "free")).toBe(false);
    expect(can("setup.freshnessReminders", "free")).toBe(false);
    expect(can("mailSync.background", "premium")).toBe(true);
  });
  it("fails closed for unknown keys", () => {
    expect(can("not.a.feature", "free")).toBe(false);
    expect(can("not.a.feature", "premium")).toBe(true);
  });
  it("has the spec limits", () => {
    expect(limit("mailSync.connect", "free")).toBe(1);
    expect(limit("mailSync.connect", "premium")).toBe(5);
    expect(limit("setup.extraEmails", "free")).toBe(3);
    expect(limit("setup.extraEmails", "premium")).toBe(10);
    expect(limit("setup.wizard", "free")).toBe(Infinity);
    expect(limit("mailSync.background", "free")).toBe(0);
  });
});
