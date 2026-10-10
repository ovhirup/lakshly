// Profile name: neutral default, Google prefill, legacy migration (synthetic names only).
import { describe, expect, it } from "vitest";
import { cleanName, DEFAULT_DISPLAY_NAME, displayName, googlePrefill, initial, migrateLegacyProfile, parseProfile } from "../lib/profile";
import * as edition from "../lib/edition";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

describe("default", () => {
  it("unset name shows 'You' and no initial (neutral icon)", () => {
    expect(DEFAULT_DISPLAY_NAME).toBe("You");
    expect(displayName(parseProfile(null))).toBe("You");
    expect(initial("")).toBe("");
    expect(initial("asha rao")).toBe("A");
    expect(initial("मीरा")).not.toBe("");
  });
  it("names are trimmed, cleaned and capped at 40 characters", () => {
    expect(cleanName("  Asha   Rao  ")).toBe("Asha Rao");
    expect(cleanName("x".repeat(60))).toHaveLength(40);
    expect(cleanName("A\u202eB")).toBe("AB");
  });
  it("no edition ships a default person's name", () => {
    expect(Object.keys(edition)).not.toContain("BETA_PROFILE_NAME");
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : []; });
    const files = ["lib", "components", "app"].flatMap((d) => walk(join(__dirname, "..", d)));
    const hits = files.filter((f) => !f.endsWith("feedback.ts") && !f.endsWith("profile.ts") /* migration reset list */ && /abhirup/i.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });
});

describe("Google prefill", () => {
  it("fills given_name only when the field is empty", () => {
    expect(googlePrefill("", "Asha", "Asha Rao")).toBe("Asha");
    expect(googlePrefill("  ", undefined, "Meera Iyer")).toBe("Meera");
    expect(googlePrefill("Ash", "Asha", "Asha Rao")).toBeNull();
    expect(googlePrefill("", undefined, "")).toBeNull();
  });
});

describe("legacy migration (plaintext v1 → encrypted v2)", () => {
  it("clears seed-like names so returning testers are asked again", () => {
    expect(migrateLegacyProfile('{"v":1,"name":"Abhirup"}')).toEqual({ v: 2, name: "" });
    expect(migrateLegacyProfile('{"v":1,"name":"abhirup "}')?.name).toBe("");
    expect(migrateLegacyProfile('{"v":1,"name":"Tester"}')?.name).toBe("");
    expect(migrateLegacyProfile('{"v":1,"name":"Abhirup","premiumSince":"2026-09-01"}')).toEqual({ v: 2, name: "", premiumSince: "2026-09-01" });
  });
  it("keeps any other name as user-entered", () => {
    expect(migrateLegacyProfile('{"v":1,"name":"Asha"}')).toEqual({ v: 2, name: "Asha", nameSource: "user" });
    expect(migrateLegacyProfile('{"v":1,"name":"Abhirupa"}')?.name).toBe("Abhirupa");
  });
  it("a v2 name the person typed is never reset (they can re-enter their own name)", () => {
    expect(migrateLegacyProfile('{"v":2,"name":"Abhirup","nameSource":"user"}')).toEqual({ v: 2, name: "Abhirup", nameSource: "user" });
    expect(parseProfile({ v: 2, name: "Abhirup", nameSource: "user" })).toEqual({ v: 2, name: "Abhirup", nameSource: "user" });
  });
  it("nothing stored, or garbage, gives an unset profile", () => {
    expect(migrateLegacyProfile(null)).toBeNull();
    expect(migrateLegacyProfile("{nope")).toEqual({ v: 2, name: "" });
    expect(parseProfile({ name: 42 })).toEqual({ v: 2, name: "" });
  });
});
