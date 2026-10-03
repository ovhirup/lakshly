import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs generator without types
import { render } from "../scripts/gen-entitlements.mjs";
import { can, FEATURES, FREE_BILL_OF_RIGHTS, limit, premiumFeatures, PRICE_TEXT, resolveTier } from "../lib/entitlements";

const json = readFileSync(new URL("../../../packages/shared/entitlements.json", import.meta.url), "utf8");

describe("entitlements.json -> entitlements.gen.ts", () => {
  it("generated file is in sync with the shared JSON", () => {
    expect(readFileSync(new URL("../lib/entitlements.gen.ts", import.meta.url), "utf8")).toBe(render(json));
  });
});

describe("tier resolution (public edition)", () => {
  it("can only ever resolve to free or premium, never superUser", () => {
    for (const v of ["superUser", "SUPERUSER", "private", "premium", "free", "", null, undefined, 1, {}]) {
      expect(["free", "premium"]).toContain(resolveTier(v));
    }
    expect(resolveTier("superUser")).toBe("free");
    expect(resolveTier("premium")).toBe("premium");
  });
  it("public source contains no switch that sets superUser", () => {
    const src = readFileSync(new URL("../lib/entitlements.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/return\s+["']superUser["']/);
    expect(src).not.toMatch(/LAKSHLY_EDITION/);
  });
});

describe("can() and limit()", () => {
  it("free gets free features, premium gets everything, unknown fails closed", () => {
    expect(can("import.statements", "free")).toBe(true);
    expect(can("themes.premium", "free")).toBe(false);
    expect(can("themes.premium", "premium")).toBe(true);
    expect(can("no.such.feature", "free")).toBe(false);
    expect(can("no.such.feature", "premium")).toBe(true);
    expect(can("__proto__", "free")).toBe(false);
  });
  it("limits come from the JSON", () => {
    expect(limit("budgets.unlimited", "free")).toBe(1);
    expect(limit("budgets.unlimited", "premium")).toBeNull();
    expect(limit("history.full", "free")).toBe(12);
    expect(limit("debt.planner", "free")).toBe(0);
    expect(limit("debt.planner", "premium")).toBeNull();
  });
  it("the Free bill of rights is never paywalled", () => {
    expect(FREE_BILL_OF_RIGHTS.length).toBeGreaterThanOrEqual(6);
    for (const id of FREE_BILL_OF_RIGHTS) expect(FEATURES[id].minTier).toBe("free");
    for (const id of premiumFeatures()) expect(FREE_BILL_OF_RIGHTS).not.toContain(id);
  });
  it("prices: ₹119/month, ₹999/year (≈₹83/month)", () => {
    expect(PRICE_TEXT).toEqual({ monthly: "₹119", yearly: "₹999", yearlyPerMonth: "₹83" });
  });
});
